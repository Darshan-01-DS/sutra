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

    const apiKey = req.headers.get('x-openai-api-key') ?? undefined
    const provider = req.headers.get('x-ai-provider') ?? 'openai'
    const baseUrl = req.headers.get('x-ai-base-url') ?? undefined
    const modelId = req.headers.get('x-ai-model') ?? 'gpt-4o-mini'
    const key = apiKey || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY
    const targetProvider = apiKey ? provider : process.env.OPENROUTER_API_KEY ? 'openrouter' : 'openai'
    const targetBaseUrl = apiKey
      ? baseUrl
      : process.env.OPENROUTER_API_KEY
        ? 'https://openrouter.ai/api/v1'
        : undefined
    const targetModelId = apiKey
      ? modelId
      : process.env.OPENROUTER_API_KEY
        ? 'openai/gpt-4o-mini'
        : 'gpt-4o-mini'

    const textSearchResults = await SignalModel.find(
      { $text: { $search: body.question.trim() }, userId: session.user.id },
      {
        score: { $meta: 'textScore' },
        _id: 1,
        title: 1,
        content: 1,
        url: 1,
        source: 1,
        type: 1,
        summary: 1,
        embedding: 1,
      }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(6)
      .lean()

    if (!key) {
      if (!textSearchResults.length) {
        return NextResponse.json({
          answer: 'I could not find matching signals in your knowledge base yet. Save a few more links, notes, or files about this topic and try again.',
          sources: [],
          fallback: true,
        })
      }

      const answer = textSearchResults
        .slice(0, 3)
        .map((signal, index) => `[${index + 1}] ${signal.title}: ${(signal.summary || signal.content || signal.title).slice(0, 220)}`)
        .join('\n\n')

      return NextResponse.json({
        answer: `Here are the closest matches from your saved knowledge:\n\n${answer}`,
        sources: textSearchResults.map((signal) => ({
          _id: String(signal._id),
          title: signal.title,
          url: signal.url,
          source: signal.source,
          type: signal.type,
          score: Math.min(0.8, (Number((signal as { score?: number }).score) || 0.5) / 10),
        })),
        fallback: true,
      })
    }

    const queryEmbedding = await getEmbeddingWithKey(body.question.trim(), {
      key,
      provider: targetProvider,
      baseUrl: targetBaseUrl,
      model: targetModelId,
    })

    const semanticCandidates = await SignalModel.find(
      { userId: session.user.id, embedding: { $exists: true, $not: { $size: 0 } } },
      { _id: 1, title: 1, content: 1, url: 1, source: 1, type: 1, embedding: 1, summary: 1 }
    ).lean()

    let scoredSignals: SearchSignal[] = semanticCandidates
      .map((signal) => ({
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
      }))
      .filter((signal) => signal.score > 0.28)
      .sort((left, right) => right.score - left.score)
      .slice(0, 6)

    const usingTextFallback = scoredSignals.length === 0
    if (usingTextFallback) {
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

    if (!scoredSignals.length) {
      return NextResponse.json({
        answer: 'I could not find relevant signals in your knowledge base for this question yet.',
        sources: [],
      })
    }

    const context = scoredSignals
      .map((signal, index) => {
        const sourceText = signal.summary || signal.content || signal.title
        return `[${index + 1}] "${signal.title}" (${signal.source ?? signal.type})\n${sourceText?.slice(0, 500) ?? ''}`
      })
      .join('\n\n---\n\n')

    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: key, baseURL: targetBaseUrl || undefined })

    const response = await openai.chat.completions.create({
      model: targetModelId,
      messages: [
        {
          role: 'system',
          content: 'You are a personal knowledge assistant. Answer using only the provided saved knowledge. Cite sources inline like [1], [2], and say clearly when the evidence is partial.',
        },
        {
          role: 'user',
          content: `Question: ${body.question.trim()}\n\nSaved knowledge:\n${context}\n\nAnswer with citations.`,
        },
      ],
      max_tokens: 500,
      temperature: 0.25,
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