// src/app/api/user/account/route.ts — Delete entire account
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/mongodb'
import UserModel from '@/lib/models/User'
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

    // Delete all user data in parallel
    await Promise.all([
      SignalModel.deleteMany({ userId }),
      CollectionModel.deleteMany({ userId }),
      UserModel.findByIdAndDelete(userId),
    ])

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to delete account' }, { status: 500 })
  }
}
