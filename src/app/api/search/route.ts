// src/app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import SignalModel from '@/lib/models/Signal'
import { getEmbedding, cosineSimilarity } from '@/lib/scraper'
import { auth } from '@/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  await connectDB()

  const session = await auth()
  const userId = session?.user?.id

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ data: [], total: 0 })

  const userFilter: Record<string, any> = userId ? { userId } : {}

  // Keyword search via MongoDB text index
  const [keywordResults, queryEmbedding] = await Promise.all([
    SignalModel.find(
      { $text: { $search: q }, ...userFilter },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(30)
      .lean(),
    getEmbedding(q),
  ])

  // If we have embeddings, do semantic search too
  let semanticResults: any[] = []
  if (queryEmbedding.length) {
    const allWithEmbeddings = await SignalModel.find(
      { embedding: { $exists: true, $not: { $size: 0 } }, ...userFilter },
      { embedding: 1, title: 1, type: 1, tags: 1, source: 1, createdAt: 1, thumbnail: 1, isFavorite: 1 }
    ).lean()

    semanticResults = allWithEmbeddings
      .map(s => ({
        ...s,
        _score: cosineSimilarity(queryEmbedding, s.embedding ?? []),
      }))
      .filter(s => s._score > 0.5)
      .sort((a, b) => b._score - a._score)
      .slice(0, 20)
  }

  // Merge + deduplicate, semantic first
  const seen = new Set<string>()
  const merged: any[] = []

  for (const s of semanticResults) {
    const id = String(s._id)
    if (!seen.has(id)) { seen.add(id); merged.push({ ...s, matchType: 'semantic', _id: id }) }
  }
  for (const s of keywordResults) {
    const id = String(s._id)
    if (!seen.has(id)) { seen.add(id); merged.push({ ...s, matchType: 'keyword', _id: id }) }
  }

  return NextResponse.json({ data: merged, total: merged.length })
}
