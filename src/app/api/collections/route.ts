// src/app/api/collections/route.ts
import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { CollectionModel } from '@/lib/models/Collection'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  await connectDB()
  const collections = await CollectionModel.find()
    .sort({ sortIndex: 1, createdAt: -1 })
    .lean()

  // Enrich with signal count (cheap enough for small collections)
  const withCounts = await Promise.all(
    collections.map(async (c: any) => {
      const count = (c.signalIds ?? []).length
      return { ...c, _id: String(c._id), signalCount: count }
    })
  )

  return NextResponse.json(withCounts)
}

export async function POST(req: Request) {
  await connectDB()
  const body = await req.json().catch(() => ({}))
  const { name, description, color, icon } = body ?? {}

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name required' }, { status: 400 })
  }

  const max = (await CollectionModel.findOne().sort({ sortIndex: -1 }).lean()) as any
  const sortIndex = (max?.sortIndex ?? 0) + 1

  const created = await CollectionModel.create({
    name,
    description: typeof description === 'string' ? description : undefined,
    color: typeof color === 'string' ? color : undefined,
    icon: typeof icon === 'string' ? icon : undefined,
    sortIndex,
    signalIds: [],
  })

  return NextResponse.json({ ...created.toJSON(), _id: String(created._id) }, { status: 201 })
}

