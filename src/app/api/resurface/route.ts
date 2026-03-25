// src/app/api/resurface/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import SignalModel from '@/lib/models/Signal'
import { auth } from '@/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  try {
    await connectDB()

    const session = await auth()
    const userId = session?.user?.id
    const userFilter: Record<string, any> = userId ? { userId } : {}

    // 1. Manually added queue
    const manualQueue = await SignalModel.find(
      { addedToResurface: true, ...userFilter },
      { _id: 1, title: 1, type: 1, url: 1, content: 1, source: 1, tags: 1, summary: 1, resurfaceNote: 1, resurfaceAt: 1, createdAt: 1 }
    ).sort({ resurfaceAt: 1, createdAt: -1 }).lean()

    // 2. AI Suggested
    // Signals older than 14 days, not viewed in 7+ days
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const aiQueue = await SignalModel.find({
      addedToResurface: { $ne: true },
      createdAt: { $lt: fourteenDaysAgo },
      $or: [
        { lastViewedAt: { $lt: sevenDaysAgo } },
        { lastViewedAt: { $exists: false } }
      ],
      ...userFilter
    })
      .select({ _id: 1, title: 1, type: 1, url: 1, content: 1, source: 1, tags: 1, summary: 1, createdAt: 1 })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()

    return NextResponse.json({ manualQueue, aiQueue })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
