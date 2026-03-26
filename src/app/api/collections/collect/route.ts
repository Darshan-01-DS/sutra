// src/app/api/collections/collect/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import SignalModel from '@/lib/models/Signal'
import { CollectionModel } from '@/lib/models/Collection'
import { auth } from '@/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const body = await req.json().catch(() => ({}))

  const collectionId: string | undefined = body?.collectionId
  const signalIds: string[] = Array.isArray(body?.signalIds) ? body.signalIds : []
  const mode: 'add' | 'remove' = body?.mode === 'remove' ? 'remove' : 'add'

  if (!collectionId || !signalIds.length) {
    return NextResponse.json({ error: 'collectionId and signalIds required' }, { status: 400 })
  }

  // Verify collection ownership
  const collection = await CollectionModel.findById(collectionId).lean()
  if (!collection || (collection as any).userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (mode === 'add') {
    await Promise.all([
      SignalModel.updateMany(
        { _id: { $in: signalIds }, userId: session.user.id },
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
        { _id: { $in: signalIds }, userId: session.user.id },
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
