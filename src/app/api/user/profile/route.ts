import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/mongodb'
import UserModel from '@/lib/models/User'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await connectDB()
    const user = await UserModel.findById(session.user.id).lean()
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    return NextResponse.json(user)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const body = await req.json()
    const { name, image } = body
    
    await connectDB()
    const user = await UserModel.findByIdAndUpdate(
      session.user.id,
      { $set: { name, image } },
      { new: true }
    )
    
    return NextResponse.json({ success: true, user })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Update failed' }, { status: 500 })
  }
}
