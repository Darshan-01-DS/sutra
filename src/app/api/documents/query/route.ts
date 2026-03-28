// src/app/api/documents/query/route.ts
// RAG query endpoint:
// 1. Embed user question
// 2. Find top-k similar chunks via MongoDB Atlas Vector Search (or cosine fallback)
// 3. Pass chunks as context to the LLM
// 4. Return answer + sources

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/mongodb'
import { DocumentChunkModel } from '@/lib/models/DocumentChunk'
import mongoose from 'mongoose'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ── Embed a query ─────────────────────────────────────────────────────────────

async function embedQuery(text: string, apiKey: string, provider?: string): Promise<number[]> {
  if (provider === 'gemini') {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/text-embedding-004',
        content: { parts: [{ text }] },
      }),
    })
    if (!res.ok) throw new Error(`Gemini Embedding error: ${res.statusText}`)
    const data = await res.json()
    return data.embedding.values
  } else if (provider === 'openrouter') {
    const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ input: text, model: 'openai/text-embedding-3-small' }),
    })
    if (!res.ok) throw new Error(`OpenRouter Embedding error: ${res.statusText}`)
    const data = await res.json()
    return data.data[0].embedding
  } else {
    // Default to OpenAI
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ input: text, model: 'text-embedding-3-small' }),
    })
    if (!res.ok) throw new Error(`OpenAI Embedding error: ${res.statusText}`)
    const data = await res.json()
    return data.data[0].embedding
  }
}

// ── Cosine similarity fallback (when Atlas VS not configured) ─────────────────

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i] }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9)
}

// ── POST /api/documents/query ─────────────────────────────────────────────────

import { checkDailyLimit, incrementUsage } from '@/lib/usage'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { question, signalIds, apiKey, baseUrl, modelName, provider } = await req.json()
    if (!question?.trim()) return NextResponse.json({ error: 'question required' }, { status: 400 })

    const targetApiKey = apiKey || process.env.OPENROUTER_API_KEY
    const targetProvider = apiKey ? (provider || 'openai') : 'openrouter'

    if (!targetApiKey) {
      return NextResponse.json({ error: 'Server AI Key is not configured.' }, { status: 500 })
    }

    if (!apiKey) {
      const usage = await checkDailyLimit(session.user.id, 'query', 30)
      if (!usage.ok) {
        return NextResponse.json({ error: 'Daily query limit reached (Free Plan). Upgrade or plug in your own API key in Settings.' }, { status: 429 })
      }
    }

    await connectDB()

    // Rate-limit increment (delay until execution starts)
    if (!apiKey) {
      await incrementUsage(session.user.id, 'query')
    }

    // 1. Embed the question
    const queryEmbedding = await embedQuery(question, targetApiKey, targetProvider)

    // 2. Retrieve relevant chunks
    let topChunks: { text: string; documentName: string; signalId: string; score: number }[] = []

    let debugInfo: any = {}
    try {
      const pipeline: any[] = [
        {
          $vectorSearch: {
            index: 'document_chunks_vector',
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: 100,
            limit: 6,
            filter: {
              userId: session.user.id,
              ...(signalIds?.length ? { signalId: { $in: signalIds } } : {}),
            },
          },
        },
        { $project: { text: 1, documentName: 1, signalId: 1, score: { $meta: 'vectorSearchScore' } } },
      ]
      if (!mongoose.connection.db) throw new Error('No DB connection')
      const results = await mongoose.connection.db
        .collection('documentchunks')
        .aggregate(pipeline)
        .toArray()
      topChunks = results.map((r: any) => ({
        text: r.text,
        documentName: r.documentName,
        signalId: String(r.signalId),
        score: r.score ?? 0,
      }))
      if (topChunks.length === 0) {
        throw new Error('Atlas Vector Search returned empty, forcing fallback')
      }
    } catch (err: any) {
      // Fallback: load all user chunks and cosine-rank locally
      const query: any = { userId: session.user.id }
      if (signalIds?.length) query.signalId = { $in: signalIds }
      
      const collCount = await (mongoose.connection.db?.collection('documentchunks').countDocuments(query) || Promise.resolve(0))
      const allChunks = await DocumentChunkModel.find(query).select('text documentName signalId embedding').lean()
      
      debugInfo = {
        mongoError: err.message,
        querySent: query,
        collCount,
        allChunksCount: allChunks.length,
      }

      const scored = allChunks.map((c: any) => ({
        text: c.text,
        documentName: c.documentName,
        signalId: String(c.signalId),
        score: cosineSim(queryEmbedding, c.embedding),
      }))
      scored.sort((a, b) => b.score - a.score)
      topChunks = scored.slice(0, 6)
    }

    if (topChunks.length === 0 || debugInfo.allChunksCount === 0) {
      return NextResponse.json({
        answer: "I couldn't find relevant content in your knowledge base. Please make sure your documents or notes are saved and processed.",
        sources: [],
      })
    }

    // 3. Build context
    const context = topChunks
      .map((c, i) => `[Source: ${c.documentName}]\n${c.text}`)
      .join('\n\n---\n\n')

    const systemPrompt = `You are an elite AI assistant powering a premium knowledge base. 
Answer the user's question using ONLY the provided document context below. 

CRITICAL RULE: If the exact answer or highly relevant information is NOT found in the context below, you MUST literally reply with: "I couldn't find the answer in the provided context." Do not guess or hallucinate generic external knowledge.

DOCUMENT CONTEXT:
${context}`

    // 4. Call the LLM
    const llmBaseUrl = apiKey ? (baseUrl || 'https://api.openai.com/v1') : 'https://openrouter.ai/api/v1'
    const llmModel = apiKey ? (modelName || 'gpt-4o-mini') : 'openai/gpt-4o-mini'

    const llmRes = await fetch(`${llmBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${targetApiKey}` },
      body: JSON.stringify({
        model: llmModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: question },
        ],
        max_tokens: 800,
        temperature: 0.2,
      }),
    })

    if (!llmRes.ok) {
      const err = await llmRes.json().catch(() => ({}))
      throw new Error(err?.error?.message ?? `LLM error: ${llmRes.statusText}`)
    }

    const llmData = await llmRes.json()
    let answer = llmData.choices?.[0]?.message?.content ?? 'No answer generated.'
    
    // Strict hallucination block interceptor
    if (answer.includes("I couldn't find the answer in the provided context")) {
      answer = "I couldn't find the answer in the uploaded context. Please ensure the relevant document or note is saved properly."
    }

    const uniqueSourcesMap = new Map<string, any>()
    for (const c of topChunks) {
      if (!uniqueSourcesMap.has(c.signalId)) {
        uniqueSourcesMap.set(c.signalId, { signalId: c.signalId, documentName: c.documentName })
      }
    }
    const uniqueSources: any[] = []
    uniqueSourcesMap.forEach(val => uniqueSources.push(val))

    return NextResponse.json({ answer, sources: uniqueSources })
  } catch (e: any) {
    console.error('[/api/documents/query]', e)
    return NextResponse.json({ error: e.message ?? 'Query failed' }, { status: 500 })
  }
}

// ── GET /api/documents/query?list=1 — list processed docs for current user ────

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    const docs = await DocumentChunkModel.aggregate([
      { $match: { userId: session.user.id } },
      { $group: { _id: '$signalId', documentName: { $first: '$documentName' }, chunks: { $sum: 1 } } },
    ])
    return NextResponse.json(docs.map(d => ({ signalId: d._id, documentName: d.documentName, chunks: d.chunks })))
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
