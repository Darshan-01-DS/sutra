// src/app/api/graph/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import SignalModel from '@/lib/models/Signal'
import { computeSimilarity } from '@/lib/similarity'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  await connectDB()

  const focusId = req.nextUrl.searchParams.get('focusId')

  // Fetch recent 100 signals with embeddings
  const signals = await SignalModel.find(
    {},
    { _id: 1, title: 1, type: 1, tags: 1, topics: 1, source: 1, embedding: 1 }
  ).sort({ createdAt: -1 }).limit(100).lean()

  // Build nodes
  const nodes = signals.map(s => ({
    id:     String(s._id),
    title:  String(s.title || '').slice(0, 25) + (String(s.title || '').length > 25 ? '…' : ''),
    type:   s.type,
    tags:   s.tags || [],
    topics: s.topics || [],
  }))

  // Build edges using the similarity engine
  const edges: {source:string; target:string; strength:string; score:number; reasons:string[]}[] = []
  const seen = new Set<string>()

  for (let i = 0; i < signals.length; i++) {
    for (let j = i + 1; j < signals.length; j++) {
      const sim = computeSimilarity(signals[i] as any, signals[j] as any)
      if (!sim) continue

      const key = [sim.signalA, sim.signalB].sort().join('|')
      if (seen.has(key)) continue
      seen.add(key)

      edges.push({
        source:   sim.signalA,
        target:   sim.signalB,
        strength: sim.strength,
        score:    parseFloat(sim.score.toFixed(3)),
        reasons:  sim.reasons,
      })
    }
  }

  return NextResponse.json({ nodes, edges, focusId })
}
