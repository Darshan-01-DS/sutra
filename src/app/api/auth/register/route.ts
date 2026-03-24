import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import UserModel from '@/lib/models/User'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const schema = z.object({
  name:     z.string().min(2).max(100),
  email:    z.string().email().max(255),
  password: z.string().min(8).max(128)
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    
    await connectDB()
    const { name, email, password } = parsed.data
    
    const existing = await UserModel.findOne({ email }).lean()
    if (existing) return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    
    const hashed = await bcrypt.hash(password, 12)
    const user = await UserModel.create({
      name,
      email,
      password: hashed,
      provider: 'credentials'
    })
    
    return NextResponse.json({ success: true, user: { id: user._id, name: user.name, email: user.email } })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Registration failed' }, { status: 500 })
  }
}
