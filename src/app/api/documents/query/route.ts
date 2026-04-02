// src/app/api/documents/query/route.ts — FIXED
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/mongodb'
import { DocumentChunkModel } from '@/lib/models/DocumentChunk'
import mongoose from 'mongoose'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ── Embed a query ─────────────────────────────────────────────────────────────

async function embedQuery(text: string, apiKey: string, provider?: string, baseUrl?: string): Promise<number[]> {
  try {
    if (provider === 'gemini') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'models/text-embedding-004', content: { parts: [{ text }] } }),
      })
      if (!res.ok) throw new Error(`Gemini Embedding error: ${res.statusText}`)
      const data = await res.json()
      return data.embedding?.values ?? []
    } else if (provider === 'openrouter' || (!provider && !baseUrl)) {
      const url = (baseUrl && provider !== 'openrouter') ? `${baseUrl}/embeddings` : 'https://openrouter.ai/api/v1/embeddings'
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ input: text, model: 'openai/text-embedding-3-small' }),
      })
      if (!res.ok) throw new Error(`Embedding error: ${res.statusText}`)
      const data = await res.json()
      return data.data?.[0]?.embedding ?? []
    } else {
      const url = baseUrl ? `${baseUrl}/embeddings` : 'https://api.openai.com/v1/embeddings'
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ input: text, model: 'text-embedding-3-small' }),
      })
      if (!res.ok) throw new Error(`OpenAI Embedding error: ${res.statusText}`)
      const data = await res.json()
      return data.data?.[0]?.embedding ?? []
    }
  } catch (e: any) {
    console.error('[embedQuery]', e.message)
    return []
  }
}

// ── Cosine similarity fallback ─────────────────────────────────────────────────

function cosineSim(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

// ── POST /api/documents/query ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'You must be signed in to query documents. Please sign in and try again.' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    let body: any = {}
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { question, signalIds, apiKey, baseUrl, modelName, provider } = body

    if (!question?.trim()) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }

    // Determine API credentials
    const targetApiKey = apiKey || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY
    const targetProvider = apiKey ? (provider || 'openai') : (process.env.OPENROUTER_API_KEY ? 'openrouter' : 'openai')

    if (!targetApiKey) {
      return NextResponse.json({
        error: 'No AI API key configured. Please add your OpenAI API key in Account Settings.',
      }, { status: 400 })
    }

    await connectDB()

    // Check if user has any processed documents
    const docCount = await DocumentChunkModel.countDocuments({ userId })
    if (docCount === 0) {
      return NextResponse.json({
        answer: "You haven't processed any PDF documents yet. Go to the Ask AI panel → PDFs tab, then click 'Process' on your PDF signals to enable document Q&A.",
        sources: [],
      })
    }

    // Embed the question
    const queryEmbedding = await embedQuery(question.trim(), targetApiKey, targetProvider, baseUrl)

    if (!queryEmbedding.length) {
      return NextResponse.json({
        error: 'Failed to generate query embedding. Please check your API key and try again.',
      }, { status: 500 })
    }

    // Retrieve relevant chunks (try Atlas Vector Search, fall back to cosine)
    let topChunks: { text: string; documentName: string; signalId: string; score: number }[] = []

    try {
      const pipeline: any[] = [
        {
          $vectorSearch: {
            index: 'document_chunks_vector',
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: 100,
            limit: 8,
            filter: {
              userId,
              ...(Array.isArray(signalIds) && signalIds.length ? { signalId: { $in: signalIds } } : {}),
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

      if (!topChunks.length) throw new Error('Atlas Vector Search returned empty')
    } catch (atlasErr: any) {
      // Cosine similarity fallback
      console.warn('[documents/query] Atlas VS not available, using cosine fallback:', atlasErr.message)
      const filter: any = { userId }
      if (Array.isArray(signalIds) && signalIds.length) filter.signalId = { $in: signalIds }

      const allChunks = await DocumentChunkModel.find(filter).select('text documentName signalId embedding').lean()

      if (!allChunks.length) {
        return NextResponse.json({
          answer: "No processed documents found. Please process your PDF signals first using the 'Process' button in the PDFs tab.",
          sources: [],
        })
      }

      const scored = allChunks.map((c: any) => ({
        text: c.text,
        documentName: c.documentName,
        signalId: String(c.signalId),
        score: cosineSim(queryEmbedding, c.embedding ?? []),
      }))
      scored.sort((a, b) => b.score - a.score)
      topChunks = scored.filter(c => c.score > 0.2).slice(0, 8)

      // If still nothing, take top 5 regardless
      if (!topChunks.length) {
        topChunks = scored.slice(0, 5)
      }
    }

    if (!topChunks.length) {
      return NextResponse.json({
        answer: "I couldn't find relevant content in your processed documents for this question. Try rephrasing or processing more documents.",
        sources: [],
      })
    }

    // Build context
    const context = topChunks
      .map((c, i) => `[Source ${i + 1}: ${c.documentName}]\n${c.text}`)
      .join('\n\n---\n\n')

    const systemPrompt = `You are an expert AI assistant answering questions based ONLY on the provided document excerpts below.

RULES:
1. Answer based ONLY on the provided context
2. If the answer is not in the context, say "I couldn't find this in the provided documents"
3. Be precise, cite which document(s) you're drawing from
4. Keep answers focused and useful
5. Use markdown formatting when helpful (bold, lists, etc.)

DOCUMENT CONTEXT:
${context}`

    // Call LLM
    const llmBaseUrl = apiKey ? (baseUrl || 'https://api.openai.com/v1') : 'https://openrouter.ai/api/v1'
    const llmModel = apiKey ? (modelName || 'gpt-4o-mini') : 'openai/gpt-4o-mini'

    let answer = ''
    try {
      const llmRes = await fetch(`${llmBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${targetApiKey}` },
        body: JSON.stringify({
          model: llmModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question.trim() },
          ],
          max_tokens: 1000,
          temperature: 0.2,
        }),
      })

      if (!llmRes.ok) {
        const err = await llmRes.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? `LLM error: ${llmRes.statusText}`)
      }

      const llmData = await llmRes.json()
      answer = llmData.choices?.[0]?.message?.content ?? 'No answer generated.'
    } catch (llmErr: any) {
      console.error('[documents/query] LLM error:', llmErr.message)
      // Return context-only fallback
      answer = `**AI generation failed** (${llmErr.message})\n\nHere are the most relevant passages from your documents:\n\n${topChunks.slice(0, 3).map((c, i) => `**${c.documentName}:**\n${c.text.slice(0, 300)}…`).join('\n\n')}`
    }

    // Deduplicate sources
    const uniqueSources = Array.from(
      new Map(topChunks.map(c => [c.signalId, { signalId: c.signalId, documentName: c.documentName }])).values()
    )

    return NextResponse.json({ answer, sources: uniqueSources })
  } catch (e: any) {
    console.error('[/api/documents/query]', e)
    return NextResponse.json({
      error: e.message ?? 'Query failed unexpectedly. Please try again.',
    }, { status: 500 })
  }
}

// ── GET /api/documents/query?list=1 — list processed docs ────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()
    const docs = await DocumentChunkModel.aggregate([
      { $match: { userId: session.user.id } },
      { $group: { _id: '$signalId', documentName: { $first: '$documentName' }, chunks: { $sum: 1 } } },
    ])
    return NextResponse.json(docs.map(d => ({ signalId: d._id, documentName: d.documentName, chunks: d.chunks })))
  } catch (e: any) {
    console.error('[GET /api/documents/query]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
