import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/mongodb'
import SignalModel from '@/lib/models/Signal'
import { cosineSimilarity, getEmbeddingWithKey } from '@/lib/scraper'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type AskRequestBody = {
  question?: string
}

type SearchSignal = {
  _id: string
  title: string
  url?: string
  source?: string
  type: string
  score: number
  content?: string
  summary?: string
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()

    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Session expired. Please sign in again.' }, { status: 401 })
    }

    const body = (await req.json()) as AskRequestBody
    if (!body.question?.trim()) {
      return NextResponse.json({ error: 'question is required' }, { status: 400 })
    }

    // Always resolve the best key: user-provided → OpenRouter system → OpenAI system → Gemini system
    const userApiKey = req.headers.get('x-openai-api-key') ?? undefined
    const userProvider = req.headers.get('x-ai-provider') ?? undefined
    const userBaseUrl = req.headers.get('x-ai-base-url') ?? undefined
    const userModelId = req.headers.get('x-ai-model') ?? undefined

    // System always has a key — never fall back to match-listing mode
    const effectiveKey = userApiKey || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY
    const effectiveProvider = userApiKey ? (userProvider || 'openai') : (process.env.OPENROUTER_API_KEY ? 'openrouter' : process.env.OPENAI_API_KEY ? 'openai' : 'gemini')
    const effectiveBaseUrl = userApiKey
      ? userBaseUrl
      : process.env.OPENROUTER_API_KEY
        ? 'https://openrouter.ai/api/v1'
        : undefined
    const effectiveModelId = userApiKey
      ? (userModelId || 'gpt-4o-mini')
      : process.env.OPENROUTER_API_KEY
        ? 'openai/gpt-4o-mini'
        : 'gpt-4o-mini'

    // Embedding config — always use Gemini for embeddings (free, accurate)
    const embeddingKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || effectiveKey
    const embeddingProvider = process.env.GEMINI_API_KEY ? 'gemini' : (process.env.OPENAI_API_KEY ? 'openai' : effectiveProvider)

    // Text search fallback (MongoDB full-text)
    let textSearchResults: any[] = []
    try {
      textSearchResults = await SignalModel.find(
        { $text: { $search: body.question.trim() }, userId: session.user.id },
        {
          score: { $meta: 'textScore' },
          _id: 1, title: 1, content: 1, url: 1, source: 1, type: 1, summary: 1, embedding: 1,
        }
      )
        .sort({ score: { $meta: 'textScore' } })
        .limit(8)
        .lean()
    } catch {
      // Text index may not exist — continue with semantic only
    }

    // Semantic search using embeddings
    const queryEmbedding = await getEmbeddingWithKey(body.question.trim(), {
      key: embeddingKey,
      provider: embeddingProvider,
    })

    const semanticCandidates = await SignalModel.find(
      { userId: session.user.id, embedding: { $exists: true, $not: { $size: 0 } } },
      { _id: 1, title: 1, content: 1, url: 1, source: 1, type: 1, embedding: 1, summary: 1 }
    ).lean()

    // Also search through document chunks (PDFs, uploaded files)
    const { DocumentChunkModel } = await import('@/lib/models/DocumentChunk')
    const chunkCandidates = await DocumentChunkModel.find(
      { userId: session.user.id, embedding: { $exists: true, $not: { $size: 0 } } },
      { _id: 1, text: 1, documentName: 1, signalId: 1, embedding: 1 }
    ).lean()

    let scoredSignals: SearchSignal[] = [
      ...semanticCandidates.map((signal) => ({
        _id: String(signal._id),
        title: signal.title,
        content: signal.content,
        summary: signal.summary,
        url: signal.url,
        source: signal.source,
        type: signal.type,
        score: queryEmbedding.length > 0
          ? cosineSimilarity(queryEmbedding, Array.isArray(signal.embedding) ? signal.embedding : [])
          : 0,
      })),
      ...chunkCandidates.map((chunk) => ({
        _id: String(chunk._id),
        title: chunk.documentName,
        content: chunk.text,
        summary: undefined,
        url: undefined,
        source: 'PDF Content',
        type: 'chunk',
        score: queryEmbedding.length > 0
          ? cosineSimilarity(queryEmbedding, Array.isArray(chunk.embedding) ? chunk.embedding : [])
          : 0,
      }))
    ]
      .filter((s) => s.score > 0.25)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)

    // If no semantic results, use text search fallback
    const usingTextFallback = scoredSignals.length === 0
    if (usingTextFallback && textSearchResults.length > 0) {
      scoredSignals = textSearchResults.map((signal) => ({
        _id: String(signal._id),
        title: signal.title,
        content: signal.content,
        summary: signal.summary,
        url: signal.url,
        source: signal.source,
        type: signal.type,
        score: 0.5,
      }))
    }

    // Nothing found at all
    if (!scoredSignals.length) {
      return NextResponse.json({
        answer: "I couldn't find relevant information in your knowledge base for this question. Try saving some articles, PDFs, or notes on this topic first.",
        sources: [],
        fallback: true,
      })
    }

    // Build context for AI
    const context = scoredSignals
      .map((signal, index) => {
        const sourceText = signal.summary || signal.content || signal.title
        const truncated = sourceText?.slice(0, 600) ?? ''
        return `[${index + 1}] "${signal.title}" (${signal.source ?? signal.type})\n${truncated}`
      })
      .join('\n\n---\n\n')

    // Generate AI answer — always possible since effectiveKey is always set
    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: effectiveKey, baseURL: effectiveBaseUrl || undefined })

    const response = await openai.chat.completions.create({
      model: effectiveModelId,
      messages: [
        {
          role: 'system',
          content: `You are a personal knowledge assistant for a thinking system called Sutra. 
Answer questions using ONLY the provided saved knowledge from the user's library.
- Cite sources inline using [1], [2], etc.
- Be concise but thorough — synthesize across sources when relevant.
- If the knowledge is partial, say so clearly and explain what you found.
- Write in clean markdown with proper formatting.`,
        },
        {
          role: 'user',
          content: `Question: ${body.question.trim()}\n\nYour saved knowledge:\n${context}\n\nAnswer with citations:`,
        },
      ],
      max_tokens: 700,
      temperature: 0.2,
    })

    const answer = response.choices[0]?.message?.content?.trim() || 'No answer generated.'

    return NextResponse.json({
      answer,
      sources: scoredSignals.map((signal) => ({
        _id: signal._id,
        title: signal.title,
        url: signal.url,
        source: signal.source,
        type: signal.type,
        score: Math.round(signal.score * 100) / 100,
      })),
      fallback: usingTextFallback,
    })
  } catch (error) {
    console.error('[POST /api/ask]', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to answer question', details: message }, { status: 500 })
  }
}