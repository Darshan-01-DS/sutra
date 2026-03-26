// src/app/api/collections/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { CollectionModel } from '@/lib/models/Collection'
import { auth } from '@/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const collections = await CollectionModel.find({ userId: session.user.id })
    .sort({ sortIndex: 1, createdAt: -1 })
    .lean()

  const withCounts = collections.map((c: any) => ({
    ...c,
    _id: String(c._id),
    signalCount: (c.signalIds ?? []).length,
  }))

  return NextResponse.json(withCounts)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const body = await req.json().catch(() => ({}))
  const { name, description, color, icon } = body ?? {}

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name required' }, { status: 400 })
  }

  const max = (await CollectionModel.findOne({ userId: session.user.id }).sort({ sortIndex: -1 }).lean()) as any
  const sortIndex = (max?.sortIndex ?? 0) + 1

  const created = await CollectionModel.create({
    userId: session.user.id,
    name,
    description: typeof description === 'string' ? description : undefined,
    color: typeof color === 'string' ? color : '#C9A96E',
    icon: typeof icon === 'string' ? icon : '◈',
    sortIndex,
    signalIds: [],
  })

  return NextResponse.json({ ...created.toJSON(), _id: String(created._id) }, { status: 201 })
}
