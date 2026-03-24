// src/app/api/stats/route.ts
import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import SignalModel from '@/lib/models/Signal'
import { ActivityModel } from '@/lib/models/Collection'
import { isDueForReview, sm2Review, estimateQuality } from '@/lib/sm2'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  await connectDB()

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [total, thisWeek, byTypeAgg, tagsAgg, topicsAgg, recentActivity, candidatesForResuface] =
    await Promise.all([
      SignalModel.countDocuments(),
      SignalModel.countDocuments({ createdAt: { $gte: weekAgo } }),
      SignalModel.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
      SignalModel.aggregate([
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 }, signals: { $push: '$_id' } } },
        { $sort: { count: -1 } },
        { $limit: 30 },
      ]),
      SignalModel.aggregate([
        {
          $project: {
            topics: {
              $cond: {
                if: { $gt: [{ $size: { $ifNull: ['$topics', []] } }, 0] },
                then: '$topics',
                else: [{
                  $switch: {
                    branches: [
                      { case: { $eq: ['$type', 'article'] }, then: 'Reading' },
                      { case: { $eq: ['$type', 'tweet'] }, then: 'Social' },
                      { case: { $eq: ['$type', 'video'] }, then: 'Video' },
                      { case: { $eq: ['$type', 'pdf'] }, then: 'Documents' },
                      { case: { $eq: ['$type', 'image'] }, then: 'Visual' },
                      { case: { $eq: ['$type', 'note'] }, then: 'Notes' }
                    ],
                    default: 'General'
                  }
                }]
              }
            }
          }
        },
        { $unwind: '$topics' },
        { $group: { _id: '$topics', count: { $sum: 1 }, signals: { $push: '$_id' } } },
        { $sort: { count: -1 } },
        { $limit: 30 },
      ]),
      ActivityModel.find().sort({ createdAt: -1 }).limit(20).lean(),
      SignalModel.find(
        {},
        {
          _id: 1, title: 1, type: 1, tags: 1,
          createdAt: 1, lastViewedAt: 1, source: 1,
          viewCount: 1, sm2NextReviewAt: 1,
          sm2EaseFactor: 1, sm2Interval: 1, sm2Repetitions: 1,
        }
      ).lean(),
    ])

  const byType: Record<string, number> = {}
  for (const row of byTypeAgg) {
    byType[row._id as string] = row.count
  }

  // Build topics array (merge manual tags and AI topics)
  const merged: Record<string, any> = {}
  for (const t of tagsAgg) {
    merged[t._id] = { name: t._id, count: t.count, signals: t.signals.map(String) }
  }
  for (const t of topicsAgg) {
    if (!merged[t._id]) {
      merged[t._id] = { name: t._id, count: t.count, signals: t.signals.map(String) }
    } else {
      merged[t._id].count += t.count
      merged[t._id].signals = Array.from(new Set([...merged[t._id].signals, ...t.signals.map(String)]))
    }
  }

  const topics = Object.values(merged)
    .sort((a,b) => b.count - a.count)
    .slice(0, 30)
    .map(t => ({
      ...t,
      trend: t.count > 20 ? 'growing' : t.count > 5 ? 'stable' : 'shrinking',
    }))

  // SM-2 based resurfacing: find signals due for review
  const resurfaceCandidates = candidatesForResuface
    .filter(s => {
      const sm2State = s.sm2NextReviewAt
        ? {
            easeFactor: (s as any).sm2EaseFactor ?? 2.5,
            interval: (s as any).sm2Interval ?? 1,
            repetitions: (s as any).sm2Repetitions ?? 0,
            nextReviewAt: new Date(s.sm2NextReviewAt),
          }
        : null
      return isDueForReview(sm2State as any)
    })
    .slice(0, 5)
    .map(s => {
      const daysAgo = Math.floor(
        (now.getTime() - new Date(s.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      )
      const daysSinceView = s.lastViewedAt
        ? Math.floor((now.getTime() - new Date(s.lastViewedAt).getTime()) / (1000 * 60 * 60 * 24))
        : undefined
      const quality = estimateQuality((s as any).viewCount ?? 0, daysAgo, daysSinceView)

      return {
        signal: { ...s, _id: String(s._id) },
        reason: daysAgo < 30
          ? `Ready for review — ${(s as any).sm2Repetitions ?? 0} reviews so far`
          : `${daysAgo} days ago you saved this — time to revisit`,
        daysAgo,
        quality,
      }
    })

  return NextResponse.json({
    total,
    thisWeek,
    byType,
    topics,
    recentActivity: recentActivity.map(a => ({ ...a, _id: String(a._id) })),
    resurface: resurfaceCandidates,
  })
}

