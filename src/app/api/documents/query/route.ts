import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { auth } from '@/auth'
import { connectDB } from '@/lib/mongodb'
import { DocumentChunkModel } from '@/lib/models/DocumentChunk'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type QueryBody = {
  question?: string
  signalIds?: string[]
  apiKey?: string
  baseUrl?: string
  modelName?: string
  provider?: string
}

type ChunkResult = {
  text: string
  documentName: string
  signalId: string
  score: number
}

type EmbeddingResponse = {
  data?: Array<{ embedding?: number[] }>
  embedding?: { values?: number[] }
}

async function embedQuery(text: string, apiKey: string, provider?: string, baseUrl?: string): Promise<number[]> {
  try {
    if (provider === 'gemini') {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'models/text-embedding-004',
            content: { parts: [{ text }] },
          }),
        }
      )

      if (!response.ok) {
        throw new Error(`Gemini embedding error: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as EmbeddingResponse
      return data.embedding?.values ?? []
    }

    const endpoint = provider === 'openrouter' || (!provider && !baseUrl)
      ? 'https://openrouter.ai/api/v1/embeddings'
      : `${baseUrl ?? 'https://api.openai.com/v1'}/embeddings`

    const model = provider === 'openrouter' || (!provider && !baseUrl)
      ? 'openai/text-embedding-3-small'
      : 'text-embedding-3-small'

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input: text, model }),
    })

    if (!response.ok) {
      throw new Error(`Embedding error: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as EmbeddingResponse
    return data.data?.[0]?.embedding ?? []
  } catch (error) {
    console.error('[documents/query][embed]', error)
    return []
  }
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (!left.length || !right.length || left.length !== right.length) {
    return 0
  }

  let dot = 0
  let leftMagnitude = 0
  let rightMagnitude = 0

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index]
    leftMagnitude += left[index] * left[index]
    rightMagnitude += right[index] * right[index]
  }

  const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude)
  return denominator === 0 ? 0 : dot / denominator
}

function buildPassageFallback(question: string, chunks: ChunkResult[]): string {
  const passages = chunks.slice(0, 3).map((chunk, index) => {
    const excerpt = chunk.text.replace(/\s+/g, ' ').trim().slice(0, 420)
    return `**[${index + 1}] ${chunk.documentName}**\n${excerpt}${excerpt.length >= 420 ? '...' : ''}`
  })

  return [
    `I could not find a direct answer to "${question}" in your PDFs, but these are the closest matching passages:`,
    '',
    ...passages,
    '',
    'Try asking with a more specific term, section name, quote, or page concept from the document.',
  ].join('\n')
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'You must be signed in to query documents. Please sign in and try again.' },
        { status: 401 }
      )
    }

    const body = (await req.json().catch(() => null)) as QueryBody | null
    if (!body?.question?.trim()) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }

    const targetApiKey = body.apiKey || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY
    const targetProvider = body.apiKey
      ? body.provider || 'openai'
      : process.env.GEMINI_API_KEY
        ? 'gemini'
        : 'openai'

    if (!targetApiKey) {
      return NextResponse.json(
        { error: 'No AI API key configured. Please add your OpenAI API key in Account Settings.' },
        { status: 400 }
      )
    }

    await connectDB()

    const chunkFilter: Record<string, unknown> = { userId: session.user.id }
    if (Array.isArray(body.signalIds) && body.signalIds.length > 0) {
      chunkFilter.signalId = { $in: body.signalIds }
    }

    const documentCount = await DocumentChunkModel.countDocuments(chunkFilter)
    if (documentCount === 0) {
      return NextResponse.json({
        answer: 'No PDF knowledge is ready yet. Upload a PDF or reprocess one from the Ask AI PDFs tab, then ask again.',
        sources: [],
      })
    }

    const queryEmbedding = await embedQuery(body.question.trim(), targetApiKey, targetProvider, body.baseUrl)
    if (!queryEmbedding.length) {
      return NextResponse.json(
        { error: 'Failed to generate a document query embedding. Please check your AI settings and try again.' },
        { status: 500 }
      )
    }

    let topChunks: ChunkResult[] = []

    try {
      const pipeline = [
        {
          $vectorSearch: {
            index: 'document_chunks_vector',
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: 100,
            limit: 8,
            filter: chunkFilter,
          },
        },
        {
          $project: {
            text: 1,
            documentName: 1,
            signalId: 1,
            score: { $meta: 'vectorSearchScore' },
          },
        },
      ]

      if (!mongoose.connection.db) {
        throw new Error('Database connection unavailable')
      }

      const vectorResults = await mongoose.connection.db
        .collection('documentchunks')
        .aggregate(pipeline)
        .toArray()

      topChunks = vectorResults.map((chunk) => ({
        text: typeof chunk.text === 'string' ? chunk.text : '',
        documentName: typeof chunk.documentName === 'string' ? chunk.documentName : 'Untitled Document',
        signalId: String(chunk.signalId ?? ''),
        score: typeof chunk.score === 'number' ? chunk.score : 0,
      }))

      if (!topChunks.length) {
        throw new Error('Atlas Vector Search returned no results')
      }
    } catch (error) {
      console.warn('[documents/query] Falling back to cosine similarity:', error)

      const allChunks = await DocumentChunkModel.find(chunkFilter)
        .select('text documentName signalId embedding')
        .lean()

      const scoredChunks = allChunks
        .map((chunk) => ({
          text: typeof chunk.text === 'string' ? chunk.text : '',
          documentName: typeof chunk.documentName === 'string' ? chunk.documentName : 'Untitled Document',
          signalId: String(chunk.signalId ?? ''),
          score: cosineSimilarity(queryEmbedding, Array.isArray(chunk.embedding) ? chunk.embedding : []),
        }))
        .sort((left, right) => right.score - left.score)

      topChunks = scoredChunks.filter((chunk) => chunk.score > 0.18).slice(0, 8)
      if (!topChunks.length) {
        topChunks = scoredChunks.slice(0, 5)
      }
    }

    if (!topChunks.length) {
      return NextResponse.json({
        answer: 'I could not find relevant content in your processed PDFs yet. Try reprocessing the document or asking a more specific question.',
        sources: [],
      })
    }

    const context = topChunks
      .map((chunk, index) => `[Source ${index + 1}: ${chunk.documentName}]\n${chunk.text}`)
      .join('\n\n---\n\n')

    const systemPrompt = `You are an expert research assistant answering questions from the user's PDF documents.

Rules:
- Use only the supplied PDF context.
- Cite sources inline like [1], [2].
- If the context only partially answers the question, say what is supported and what is missing.
- Do not answer with the phrase "I couldn't find this in the provided documents" unless there is truly no useful evidence at all.
- Prefer concise, precise answers over generic summaries.`

    const llmBaseUrl = body.apiKey
      ? body.baseUrl || 'https://api.openai.com/v1'
      : 'https://openrouter.ai/api/v1'
    const llmModel = body.apiKey
      ? body.modelName || 'gpt-4o-mini'
      : 'openai/gpt-4o-mini'

    let answer = ''

    try {
      const response = await fetch(`${llmBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${targetApiKey}`,
        },
        body: JSON.stringify({
          model: llmModel,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `Question: ${body.question.trim()}\n\nPDF Context:\n${context}\n\nAnswer with citations.`,
            },
          ],
          max_tokens: 900,
          temperature: 0.2,
        }),
      })

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => ({}))) as { error?: { message?: string } }
        throw new Error(errorPayload.error?.message ?? `${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }

      answer = data.choices?.[0]?.message?.content?.trim() ?? ''
    } catch (error) {
      console.error('[documents/query][llm]', error)
      answer = buildPassageFallback(body.question.trim(), topChunks)
    }

    if (
      !answer ||
      /i couldn't find this in the provided documents/i.test(answer) ||
      /i couldn't find the answer in the provided context/i.test(answer)
    ) {
      answer = buildPassageFallback(body.question.trim(), topChunks)
    }

    const sources = Array.from(
      new Map(
        topChunks.map((chunk) => [
          chunk.signalId,
          { signalId: chunk.signalId, documentName: chunk.documentName },
        ])
      ).values()
    )

    return NextResponse.json({ answer, sources })
  } catch (error) {
    console.error('[/api/documents/query]', error)
    const message = error instanceof Error ? error.message : 'Query failed unexpectedly. Please try again.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()
    const docs = await DocumentChunkModel.aggregate([
      { $match: { userId: session.user.id } },
      { $group: { _id: '$signalId', documentName: { $first: '$documentName' }, chunks: { $sum: 1 } } },
      { $sort: { documentName: 1 } },
    ])

    return NextResponse.json(
      docs.map((doc) => ({
        signalId: String(doc._id),
        documentName: typeof doc.documentName === 'string' ? doc.documentName : 'Untitled Document',
        chunks: typeof doc.chunks === 'number' ? doc.chunks : 0,
      }))
    )
  } catch (error) {
    console.error('[GET /api/documents/query]', error)
    const message = error instanceof Error ? error.message : 'Failed to load processed documents.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}