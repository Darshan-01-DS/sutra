// src/app/api/collections/collect/route.ts
import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import SignalModel from '@/lib/models/Signal'
import { CollectionModel } from '@/lib/models/Collection'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: Request) {
  await connectDB()
  const body = await req.json().catch(() => ({}))

  const collectionId: string | undefined = body?.collectionId
  const signalIds: string[] = Array.isArray(body?.signalIds) ? body.signalIds : []
  const mode: 'add' | 'remove' = body?.mode === 'remove' ? 'remove' : 'add'

  if (!collectionId || !signalIds.length) {
    return NextResponse.json({ error: 'collectionId and signalIds required' }, { status: 400 })
  }

  if (mode === 'add') {
    await Promise.all([
      SignalModel.updateMany(
        { _id: { $in: signalIds } },
        { $addToSet: { collectionIds: collectionId } }
      ),
      CollectionModel.findByIdAndUpdate(
        collectionId,
        { $addToSet: { signalIds: { $each: signalIds } } },
        { new: true }
      ),
    ])
  } else {
    await Promise.all([
      SignalModel.updateMany(
        { _id: { $in: signalIds } },
        { $pull: { collectionIds: collectionId } }
      ),
      CollectionModel.findByIdAndUpdate(
        collectionId,
        { $pull: { signalIds: { $in: signalIds } } },
        { new: true }
      ),
    ])
  }

  return NextResponse.json({ success: true })
}

