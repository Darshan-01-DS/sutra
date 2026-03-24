// src/app/api/signals/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import SignalModel from '@/lib/models/Signal'
import { ActivityModel } from '@/lib/models/Collection'
import { sm2Review, estimateQuality } from '@/lib/sm2'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  await connectDB()

  const signal = await SignalModel.findById(params.id).lean()
  if (!signal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Increment view count + advance SM-2 schedule
  const daysAgo = Math.floor(
    (Date.now() - new Date((signal as any).createdAt).getTime()) / (1000 * 60 * 60 * 24)
  )
  const daysSinceView = (signal as any).lastViewedAt
    ? Math.floor((Date.now() - new Date((signal as any).lastViewedAt).getTime()) / (1000 * 60 * 60 * 24))
    : undefined
  const quality = estimateQuality((signal as any).viewCount ?? 0, daysAgo, daysSinceView)
  const sm2 = sm2Review(
    {
      easeFactor: (signal as any).sm2EaseFactor ?? 2.5,
      interval: (signal as any).sm2Interval ?? 1,
      repetitions: (signal as any).sm2Repetitions ?? 0,
      nextReviewAt: (signal as any).sm2NextReviewAt ?? new Date(),
    },
    quality
  )

  await SignalModel.findByIdAndUpdate(params.id, {
    $inc:  { viewCount: 1 },
    $set:  {
      lastViewedAt: new Date(),
      sm2EaseFactor: sm2.easeFactor,
      sm2Interval: sm2.interval,
      sm2Repetitions: sm2.repetitions,
      sm2NextReviewAt: sm2.nextReviewAt,
    },
  })

  // Log activity for viewed
  await ActivityModel.create({
    type:        'viewed',
    message:     `Revisited "${(signal as any).title?.slice(0, 50)}"`,
    signalId:    signal._id,
    signalTitle: (signal as any).title,
    color:       '#E8705A',
  })

  return NextResponse.json({ ...signal, _id: String(signal._id) })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  await connectDB()

  const body = await req.json()
  const allowedFields = ['title', 'content', 'tags', 'topics', 'isFavorite', 'highlights', 'collectionIds', 'summary', 'addedToResurface', 'resurfaceNote']
  const update: Record<string, any> = {}
  for (const field of allowedFields) {
    if (field in body) update[field] = body[field]
  }

  const signal = await SignalModel.findByIdAndUpdate(
    params.id,
    { $set: update },
    { new: true, lean: true }
  )

  if (!signal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if ('isFavorite' in body && body.isFavorite) {
    await ActivityModel.create({
      type:        'highlighted',
      message:     `Favorited "${(signal as any).title?.slice(0, 50)}"`,
      signalId:    signal._id,
      signalTitle: (signal as any).title,
      color:       '#C9A96E',
    })
  }

  return NextResponse.json({ ...signal, _id: String(signal._id) })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  await connectDB()

  const signal = await SignalModel.findByIdAndDelete(params.id)
  if (!signal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ success: true })
}
