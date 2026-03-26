// src/app/api/user/onboarding/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/mongodb'
import UserModel from '@/lib/models/User'

export const dynamic = 'force-dynamic'

export async function PATCH() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    await UserModel.findByIdAndUpdate(session.user.id, { hasSeenOnboarding: true })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
