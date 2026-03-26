// src/app/api/collections/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { CollectionModel } from '@/lib/models/Collection'
import SignalModel from '@/lib/models/Signal'
import { auth } from '@/auth'

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const collection = await CollectionModel.findById(params.id).lean()
  if (!collection) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if ((collection as any).userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { name, description, color, icon } = body

  const updated = await CollectionModel.findByIdAndUpdate(
    params.id,
    { $set: { name, description, color, icon } },
    { new: true, lean: true }
  )

  return NextResponse.json({ ...updated, _id: String((updated as any)._id) })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const collection = await CollectionModel.findById(params.id).lean()
  if (!collection) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if ((collection as any).userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Remove this collection from all signals' collectionIds
  await SignalModel.updateMany(
    { userId: session.user.id, collectionIds: params.id },
    { $pull: { collectionIds: params.id } }
  )

  await CollectionModel.findByIdAndDelete(params.id)
  return NextResponse.json({ success: true })
}
