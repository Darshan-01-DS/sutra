// src/app/api/tags/route.ts
import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import SignalModel from '@/lib/models/Signal'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  await connectDB()

  const agg = await SignalModel.aggregate([
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 30 },
  ])

  return NextResponse.json(agg.map(t => ({ tag: t._id, count: t.count })))
}
