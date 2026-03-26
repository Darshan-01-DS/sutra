// src/app/api/user/signals/route.ts — Clear all signals for the user
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/mongodb'
import SignalModel from '@/lib/models/Signal'
import { CollectionModel } from '@/lib/models/Collection'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function DELETE() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    const userId = session.user.id

    // Delete all signals and clear signalIds from collections
    await Promise.all([
      SignalModel.deleteMany({ userId }),
      CollectionModel.updateMany({ userId }, { $set: { signalIds: [] } }),
    ])

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to clear signals' }, { status: 500 })
  }
}
