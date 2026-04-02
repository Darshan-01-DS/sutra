import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/mongodb'
import { ActivityModel } from '@/lib/models/Collection'
import SignalModel from '@/lib/models/Signal'
import { autoTag, cosineSimilarity, generateSummary, getEmbeddingWithKey, scrapeUrl, generateFullContentNote } from '@/lib/scraper'
import { initialSM2State } from '@/lib/sm2'
import { SignalType } from '@/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SaveSignalBody = {
  url?: string
  content?: string
  title?: string
  type?: SignalType
  tags?: string[]
  collectionIds?: string[]
}

function cleanTitle(title: string | undefined, fallback: string): string {
  const value = title?.trim()
  return value && value.length > 0 ? value : fallback
}

function normalizeUserTags(tags: string[] | undefined): string[] {
  if (!Array.isArray(tags)) {
    return []
  }

  return tags
    .map((tag) => tag.replace(/^#+/, '').trim().toLowerCase())
    .filter(Boolean)
}

export async function GET(req: NextRequest) {
  try {
    await connectDB()

    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = req.nextUrl
    const page = Number.parseInt(searchParams.get('page') ?? '1', 10)
    const limit = Number.parseInt(searchParams.get('limit') ?? '24', 10)
    const type = searchParams.get('type') as SignalType | null
    const tag = searchParams.get('tag')
    const topic = searchParams.get('topic')
    const collectionId = searchParams.get('collectionId')
    const favorite = searchParams.get('favorite')
    const sort = searchParams.get('sort') ?? 'newest'
    const url = searchParams.get('url')?.trim()

    const filter: Record<string, unknown> = { userId: session.user.id }
    if (type) filter.type = type
    if (url) filter.url = url
    if (topic) filter.topics = { $in: [topic] }
    if (collectionId) filter.collectionIds = collectionId
    if (favorite === 'true') filter.isFavorite = true

    if (tag) {
      const cleanTag = tag.replace(/^#+/, '').toLowerCase().trim()
      filter.$or = [{ tags: cleanTag }, { topics: cleanTag }]
    }

    const sortMap: Record<string, Record<string, 1 | -1>> = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      viewed: { viewCount: -1 },
      favorites: { isFavorite: -1, createdAt: -1 },
    }

    const [data, total] = await Promise.all([
      SignalModel.find(filter)
        .sort(sortMap[sort] ?? { createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SignalModel.countDocuments(filter),
    ])

    return NextResponse.json({
      data: data.map((signal) => ({ ...signal, _id: String(signal._id) })),
      total,
      page,
      limit,
      hasMore: page * limit < total,
    })
  } catch (error) {
    console.error('[GET /api/signals]', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch signals'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()

    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as SaveSignalBody
    const aiConfig = {
      key: req.headers.get('x-openai-api-key') || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || undefined,
      provider: req.headers.get('x-openai-api-key')
        ? req.headers.get('x-ai-provider') || undefined
        : process.env.GEMINI_API_KEY
          ? 'gemini'
          : undefined,
      baseUrl: req.headers.get('x-ai-base-url') || undefined,
      model: req.headers.get('x-ai-model') || undefined,
    }

    const { url, content, title: manualTitle, type: manualType, tags: userTags, collectionIds } = body

    let signalData: Record<string, unknown>

    if (url?.trim()) {
      const meta = await scrapeUrl(url)
      const title = cleanTitle(manualTitle, meta.title || new URL(url).hostname)
      const primaryContent = meta.content?.trim() || meta.description?.trim() || undefined
      
      const enhancedContent = await generateFullContentNote(title, primaryContent, aiConfig) || primaryContent

      const summary = await generateSummary(title, enhancedContent, aiConfig)

      signalData = {
        userId: session.user.id,
        url,
        title,
        content: enhancedContent,
        summary,
        source: meta.source,
        thumbnail: meta.thumbnail,
        type: manualType || meta.type,
        readTime: meta.readTime,
        duration: meta.duration,
      }
    } else if (content?.trim()) {
      const title = cleanTitle(manualTitle, content.trim().slice(0, 80))
      const cleanContent = content.trim()
      const summary = await generateSummary(title, cleanContent, aiConfig)

      signalData = {
        userId: session.user.id,
        title,
        content: cleanContent,
        summary,
        type: manualType ?? 'note',
        source: 'note',
      }
    } else {
      return NextResponse.json({ error: 'url or content required' }, { status: 400 })
    }

    const textForAI = [signalData.title, signalData.summary, signalData.content]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join('\n\n')

    let generatedTags: string[] = []
    let topics: string[] = []
    let embedding: number[] = []

    try {
      const tagResult = await autoTag(String(signalData.title), typeof signalData.content === 'string' ? signalData.content : undefined, aiConfig)
      generatedTags = tagResult.tags
      topics = tagResult.topics
    } catch (error) {
      console.warn('[POST /api/signals] autoTag failed:', error)
    }

    try {
      embedding = await getEmbeddingWithKey(textForAI, aiConfig)
    } catch (error) {
      console.warn('[POST /api/signals] embedding failed:', error)
    }

    const mergedTags = Array.from(new Set([...normalizeUserTags(userTags), ...generatedTags]))
    signalData.tags = mergedTags
    signalData.topics = topics
    signalData.embedding = embedding

    if (Array.isArray(collectionIds) && collectionIds.length > 0) {
      signalData.collectionIds = collectionIds
    }

    if (embedding.length > 0) {
      try {
        const relatedSignals = await SignalModel.find(
          { userId: session.user.id, embedding: { $exists: true, $not: { $size: 0 } } },
          { _id: 1, embedding: 1 }
        ).lean()

        const relatedIds = relatedSignals
          .map((signal) => ({
            id: signal._id,
            score: cosineSimilarity(embedding, Array.isArray(signal.embedding) ? signal.embedding : []),
          }))
          .filter((signal) => signal.score > 0.75)
          .sort((left, right) => right.score - left.score)
          .slice(0, 5)
          .map((signal) => signal.id)

        signalData.relatedIds = relatedIds
      } catch (error) {
        console.warn('[POST /api/signals] related signals failed:', error)
      }
    }

    const sm2 = initialSM2State()
    signalData.sm2EaseFactor = sm2.easeFactor
    signalData.sm2Interval = sm2.interval
    signalData.sm2Repetitions = sm2.repetitions
    signalData.sm2NextReviewAt = sm2.nextReviewAt

    const signal = await SignalModel.create(signalData)

    if (embedding.length > 0 && textForAI) {
      const { DocumentChunkModel } = await import('@/lib/models/DocumentChunk')
      await DocumentChunkModel.create({
        userId: session.user.id,
        signalId: String(signal._id),
        documentName: signal.title ?? 'Saved Signal',
        chunkIndex: 0,
        text: textForAI,
        embedding,
        metadata: {
          fileName: signal.title ?? 'signal',
          uploadDate: new Date(),
        },
      }).catch((error: unknown) => {
        console.warn('[POST /api/signals] RAG index failed:', error)
      })
    }

    if (Array.isArray(collectionIds) && collectionIds.length > 0) {
      const { CollectionModel } = await import('@/lib/models/Collection')
      await Promise.all(
        collectionIds.map((collectionId) =>
          CollectionModel.findOneAndUpdate(
            { _id: collectionId, userId: session.user.id },
            { $addToSet: { signalIds: signal._id } }
          ).catch(() => null)
        )
      )
    }

    await ActivityModel.create({
      type: 'saved',
      message: `Saved "${String(signal.title).slice(0, 60)}"`,
      signalId: signal._id,
      signalTitle: signal.title,
      color: '#C9A96E',
    })

    if (mergedTags.length > 0) {
      await ActivityModel.create({
        type: 'tagged',
        message: `AI tagged "${String(signal.title).slice(0, 40)}" -> ${mergedTags.slice(0, 3).join(', ')}`,
        signalId: signal._id,
        signalTitle: signal.title,
        color: '#9B8FF5',
      })
    }

    return NextResponse.json({ ...signal.toJSON(), _id: String(signal._id) }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/signals]', error)
    const message = error instanceof Error ? error.message : 'Unknown server error'
    return NextResponse.json({ error: 'Failed to save signal', details: message }, { status: 500 })
  }
}