// src/app/api/collections/route.ts — FIXED
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { CollectionModel } from '@/lib/models/Collection'
import { auth } from '@/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    const collections = await CollectionModel.find({ userId: session.user.id })
      .sort({ sortIndex: 1, createdAt: -1 })
      .lean()

    const withCounts = collections.map((c: any) => ({
      ...c,
      _id: String(c._id),
      signalCount: Array.isArray(c.signalIds) ? c.signalIds.length : 0,
    }))

    return NextResponse.json(withCounts)
  } catch (e: any) {
    console.error('[GET /api/collections]', e)
    return NextResponse.json({ error: e?.message || 'Failed to fetch collections' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    
    let body: any = {}
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { name, description, color, icon } = body ?? {}

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Collection name is required' }, { status: 400 })
    }

    // Get max sortIndex for ordering
    const lastCol = await CollectionModel.findOne({ userId: session.user.id })
      .sort({ sortIndex: -1 })
      .lean() as any
    const sortIndex = (lastCol?.sortIndex ?? -1) + 1

    const created = await CollectionModel.create({
      userId: session.user.id,
      name: name.trim().slice(0, 100),
      description: typeof description === 'string' ? description.trim().slice(0, 500) : undefined,
      color: typeof color === 'string' && color.startsWith('#') ? color : '#C9A96E',
      icon: typeof icon === 'string' ? icon : '◈',
      sortIndex,
      signalIds: [],
    })

    const result = {
      ...created.toJSON(),
      _id: String(created._id),
      signalCount: 0,
    }

    return NextResponse.json(result, { status: 201 })
  } catch (e: any) {
    console.error('[POST /api/collections]', e)
    return NextResponse.json({ error: e?.message || 'Failed to create collection' }, { status: 500 })
  }
}
