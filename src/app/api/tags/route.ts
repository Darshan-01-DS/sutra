// src/app/api/tags/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import SignalModel from '@/lib/models/Signal'
import { auth } from '@/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  await connectDB()

  const session = await auth()
  const userId = session?.user?.id
  const q = req.nextUrl.searchParams.get('q')?.trim().toLowerCase()

  const pipeline: any[] = []
  if (userId) pipeline.push({ $match: { userId } })
  pipeline.push(
    { $unwind: '$tags' },
    // Normalize: strip leading '#' from any legacy stored tags
    { $addFields: { tags: { $ltrim: { input: '$tags', chars: '#' } } } },
    ...(q ? [{ $match: { tags: { $regex: `^${q}`, $options: 'i' } } }] : []),
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: q ? 8 : 30 },
  )

  const agg = await SignalModel.aggregate(pipeline)
  return NextResponse.json(agg.map(t => ({ tag: t._id, count: t.count })))
}
