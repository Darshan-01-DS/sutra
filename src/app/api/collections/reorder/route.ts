// src/app/api/collections/reorder/route.ts
import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { CollectionModel } from '@/lib/models/Collection'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function PATCH(req: Request) {
  await connectDB()
  const body = await req.json().catch(() => ({}))
  const orderedIds: string[] = Array.isArray(body?.orderedIds) ? body.orderedIds : []

  if (!orderedIds.length) {
    return NextResponse.json({ error: 'orderedIds required' }, { status: 400 })
  }

  await Promise.all(
    orderedIds.map((id, idx) =>
      CollectionModel.findByIdAndUpdate(id, { $set: { sortIndex: idx } })
    )
  )

  return NextResponse.json({ success: true })
}

