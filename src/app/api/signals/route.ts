// src/app/api/signals/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import SignalModel from '@/lib/models/Signal'
import { ActivityModel } from '@/lib/models/Collection'
import { scrapeUrl, autoTag, getEmbeddingWithKey, cosineSimilarity } from '@/lib/scraper'
import { detectTypeFromUrl } from '@/lib/utils'
import { SignalType } from '@/types'
import { initialSM2State } from '@/lib/sm2'
import { auth } from '@/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ── GET /api/signals ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  await connectDB()

  const session = await auth()
  const userId = session?.user?.id

  const { searchParams } = req.nextUrl
  const page    = parseInt(searchParams.get('page') ?? '1')
  const limit   = parseInt(searchParams.get('limit') ?? '24')
  const type    = searchParams.get('type') as SignalType | null
  const tag     = searchParams.get('tag')
  const topic   = searchParams.get('topic')
  const collectionId = searchParams.get('collectionId')
  const fav     = searchParams.get('favorite')
  const sort    = searchParams.get('sort') ?? 'newest'

  const filter: Record<string, any> = {}
  if (userId) filter.userId = userId
  if (type)  filter.type = type
  if (tag) {
    const cleanTag = tag.replace(/^#+/, '').toLowerCase().trim()
    filter.$or = [
      { tags: cleanTag },
      { topics: cleanTag }
    ]
  }
  if (topic) filter.topics = { $in: [topic] }
  if (collectionId) filter.collectionIds = collectionId
  if (fav === 'true') filter.isFavorite = true

  const sortMap: Record<string, any> = {
    newest:    { createdAt: -1 },
    oldest:    { createdAt: 1 },
    viewed:    { viewCount: -1 },
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
    data: data.map(s => ({ ...s, _id: String(s._id) })),
    total,
    page,
    limit,
    hasMore: page * limit < total,
  })
}

// ── POST /api/signals ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    await connectDB()

    const session = await auth()
    const userId = session?.user?.id

    const body = await req.json()
    const { url, content, title: manualTitle, type: manualType, tags: userTags, collectionIds: userCollectionIds } = body
    const aiConfig = {
      key: req.headers.get('x-openai-api-key') ?? undefined,
      provider: req.headers.get('x-ai-provider') ?? undefined,
      baseUrl: req.headers.get('x-ai-base-url') ?? undefined,
      model: req.headers.get('x-ai-model') ?? undefined,
    }

    let signalData: any = {}

    if (url) {
      // Scrape metadata from URL
      const meta = await scrapeUrl(url)
      signalData = {
        url,
        title:     manualTitle || meta.title,
        content:   meta.description,
        source:    meta.source,
        thumbnail: meta.thumbnail,
        type:      manualType || meta.type,
        readTime:  meta.readTime,
        duration:  meta.duration,
      }
    } else if (content) {
      // Plain note / text capture
      signalData = {
        title:   manualTitle || content.slice(0, 80),
        content,
        type:    manualType ?? 'note',
        source:  'note',
      }
    } else {
      return NextResponse.json({ error: 'url or content required' }, { status: 400 })
    }

    // Attach userId
    if (userId) signalData.userId = userId

    // AI auto-tagging + embedding (separated to prevent one failure silently killing the other)
    const textForAI = `${signalData.title} ${signalData.content ?? ''}`.trim()
    let tags: string[] = []
    let topics: string[] = []
    let embedding: number[] = []

    try {
      const tagResult = await autoTag(signalData.title, signalData.content, aiConfig)
      tags = tagResult.tags
      topics = tagResult.topics
    } catch (e: any) {
      console.warn('AutoTag failed:', e.message)
    }

    try {
      embedding = await getEmbeddingWithKey(textForAI, aiConfig)
    } catch (e: any) {
      console.warn('Embedding failed:', e.message)
    }

    // Merge user-provided tags with AI-generated tags (user tags take priority)
    const mergedTags = Array.from(new Set([
      ...(Array.isArray(userTags) ? userTags.map((t: string) => t.replace(/^#+/, '').trim().toLowerCase()).filter(Boolean) : []),
      ...tags,
    ]))
    signalData.tags = mergedTags
    signalData.topics = topics
    signalData.embedding = embedding

    // Attach user-provided collectionIds
    if (Array.isArray(userCollectionIds) && userCollectionIds.length > 0) {
      signalData.collectionIds = userCollectionIds
    }

    // Find related signals via cosine similarity
    if (embedding.length) {
      try {
        const relatedFilter: Record<string, any> = { embedding: { $exists: true, $not: { $size: 0 } } }
        if (userId) relatedFilter.userId = userId

        const allSignals = await SignalModel.find(
          relatedFilter,
          { _id: 1, embedding: 1 }
        ).lean()

        const scored = allSignals
          .map(s => ({ id: s._id, score: cosineSimilarity(embedding, s.embedding ?? []) }))
          .filter(s => s.score > 0.75)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)

        signalData.relatedIds = scored.map(s => s.id)
      } catch {
        // Skip related signals on error
      }
    }

    // Initialize SM-2 state for this new signal
    const sm2 = initialSM2State()
    signalData.sm2EaseFactor = sm2.easeFactor
    signalData.sm2Interval = sm2.interval
    signalData.sm2Repetitions = sm2.repetitions
    signalData.sm2NextReviewAt = sm2.nextReviewAt

    const signal = await SignalModel.create(signalData)

    // Global RAG Indexing: Insert note into DocumentChunkModel if embedding exists
    if (signalData.embedding?.length) {
      const { DocumentChunkModel } = await import('@/lib/models/DocumentChunk')
      await DocumentChunkModel.create({
        userId: signal.userId,
        signalId: String(signal._id),
        documentName: signal.title ?? 'Saved Note',
        chunkIndex: 0,
        text: textForAI,
        embedding: signalData.embedding,
        metadata: {
          fileName: 'note',
          uploadDate: new Date(),
        }
      }).catch(err => console.warn('Global RAG index failed:', err.message))
    }
    // Update collection signal lists if collectionIds were provided
    if (Array.isArray(userCollectionIds) && userCollectionIds.length > 0) {
      const { CollectionModel } = await import('@/lib/models/Collection')
      await Promise.all(
        userCollectionIds.map((colId: string) =>
          CollectionModel.findOneAndUpdate(
            { _id: colId, userId },
            { $addToSet: { signalIds: signal._id } }
          ).catch(() => null)
        )
      )
    }

    // Log activity
    await ActivityModel.create({
      type:        'saved',
      message:     `Saved "${signal.title.slice(0, 60)}"`,
      signalId:    signal._id,
      signalTitle: signal.title,
      color:       '#C9A96E',
    })

    if (tags.length) {
      await ActivityModel.create({
        type:        'tagged',
        message:     `AI tagged "${signal.title.slice(0, 40)}" → ${tags.slice(0, 3).join(', ')}`,
        signalId:    signal._id,
        signalTitle: signal.title,
        color:       '#9B8FF5',
      })
    }

    return NextResponse.json({ ...signal.toJSON(), _id: String(signal._id) }, { status: 201 })
  } catch (e: any) {
    console.error('Save signal error:', e)
    return NextResponse.json(
      { error: 'Failed to save signal', details: e?.message ? String(e.message) : 'Unknown server error' },
      { status: 500 }
    )
  }
}
