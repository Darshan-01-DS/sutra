// src/app/api/ask/route.ts
// RAG (Retrieval-Augmented Generation) — ask questions, get answers from your knowledge base
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import SignalModel from '@/lib/models/Signal'
import { getEmbeddingWithKey, cosineSimilarity } from '@/lib/scraper'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: NextRequest) {
  try {
    await connectDB()

    const body = await req.json()
    const { question } = body
    const apiKey = req.headers.get('x-openai-api-key') ?? undefined
    const provider = req.headers.get('x-ai-provider') ?? 'openai'
    const baseUrl = req.headers.get('x-ai-base-url') ?? undefined
    const modelId = req.headers.get('x-ai-model') ?? 'gpt-4o-mini'

    if (!question?.trim()) {
      return NextResponse.json({ error: 'question is required' }, { status: 400 })
    }

    const key = apiKey ?? process.env.OPENAI_API_KEY

    // 1. Text-search fallback (always try this first if no key or embeddings)
    const textSearchResults = await SignalModel.find(
      { $text: { $search: question.trim() } },
      { score: { $meta: 'textScore' }, _id: 1, title: 1, content: 1, url: 1, source: 1, tags: 1, type: 1, summary: 1, embedding: 1 }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(6)
      .lean()

    // 2. If no API key, return text-search answer
    if (!key) {
      if (!textSearchResults.length) {
        return NextResponse.json({
          answer: "I couldn't find relevant signals in your knowledge base for this question. Try saving more content related to this topic, or add your OpenAI API key in Settings for semantic search.",
          sources: [],
          fallback: true,
        })
      }

      const fallbackAnswer = textSearchResults
        .slice(0, 3)
        .map((s, i) => {
          const text = s.summary || s.content || s.title
          return `[${i + 1}] ${s.title}: ${text?.slice(0, 200) ?? ''}`
        })
        .join('\n\n')

      return NextResponse.json({
        answer: `Based on keyword search in your knowledge base:\n\n${fallbackAnswer}\n\nAdd your OpenAI API key in Settings for AI-powered semantic search.`,
        sources: textSearchResults.map(s => ({
          _id: String(s._id),
          title: s.title,
          url: (s as any).url,
          source: s.source,
          type: s.type,
          score: Math.min(0.8, ((s as any).score ?? 0.5) / 10),
        })),
        fallback: true,
      })
    }

    // 3. Embed the question for semantic search
    const queryEmbedding = await getEmbeddingWithKey(question.trim(), { key: apiKey, provider, baseUrl, model: modelId })
    
    // 4. Retrieve top-k most relevant signals via cosine similarity
    const allSignals = await SignalModel.find(
      { embedding: { $exists: true, $not: { $size: 0 } } },
      { _id: 1, title: 1, content: 1, url: 1, source: 1, tags: 1, type: 1, embedding: 1, summary: 1 }
    ).lean()

    let scored = allSignals
      .map(s => ({
        ...s,
        _id: String(s._id),
        score: queryEmbedding.length > 0 ? cosineSimilarity(queryEmbedding, s.embedding ?? []) : 0,
      }))
      .filter(s => s.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)

    // If no embedding matches, use text search results
    const useFallback = scored.length === 0
    if (useFallback) {
      scored = textSearchResults.map(s => ({
        ...s,
        _id: String(s._id),
        score: 0.5,
      })) as any[]
    }

    if (!scored.length) {
      return NextResponse.json({
        answer: "I couldn't find relevant signals in your knowledge base for this question. Try saving more content related to this topic.",
        sources: [],
      })
    }

    // 3. Build context from retrieved signals
    const context = scored
      .map((s, i) => {
        const text = s.summary || s.content || s.title
        return `[${i + 1}] "${s.title}" (${s.source ?? s.type})\n${text?.slice(0, 400)}`
      })
      .join('\n\n---\n\n')

    // 4. Generate answer using custom or default model
    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ 
      apiKey: key,
      baseURL: baseUrl || undefined
    })

    const systemPrompt = `You are a personal knowledge assistant. You answer questions based ONLY on the user's saved knowledge base.

Rules:
- Answer concisely and directly
- Cite your sources with [1], [2] etc.
- If the context doesn't fully answer the question, say so
- Synthesize across multiple sources when relevant
- Do NOT make up information not in the context`

    const userPrompt = `Question: ${question}

Your saved knowledge (use ONLY this to answer):

${context}

Answer with citations:`

    let answer = ''
    try {
      const res = await openai.chat.completions.create({
        model: modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 500,
        temperature: 0.3,
      })
      answer = res.choices[0].message.content ?? 'No answer generated.'
    } catch (openaiErr: any) {
      console.error('OpenAI generation error:', openaiErr.message)
      const fallbackText = scored.slice(0, 3).map((s, i) => `[${i + 1}] ${s.title}: ${(s.summary || s.content || '').slice(0, 200)}`).join('\n\n')
      
      return NextResponse.json({
        answer: `AI Error: ${openaiErr.message}\n\nFalling back to search results:\n\n${fallbackText}`,
        sources: scored.map(s => ({
          _id: s._id,
          title: s.title,
          url: (s as any).url,
          source: s.source,
          type: s.type,
          score: Math.round(s.score * 100) / 100,
        })),
        fallback: true
      })
    }

    return NextResponse.json({
      answer,
      sources: scored.map(s => ({
        _id: s._id,
        title: s.title,
        url: (s as any).url,
        source: s.source,
        type: s.type,
        score: Math.round(s.score * 100) / 100,
      })),
    })
  } catch (e: any) {
    console.error('RAG error:', e)
    return NextResponse.json(
      { error: 'Failed to answer question', details: e?.message ?? 'Unknown error' },
      { status: 500 }
    )
  }
}
