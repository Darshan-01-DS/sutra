// src/app/api/clusters/route.ts
// Auto-clustering of signals using embedding similarity
import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import SignalModel from '@/lib/models/Signal'
import { cosineSimilarity } from '@/lib/scraper'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Cluster {
  id: string
  name: string
  signals: { _id: string; title: string; type: string; score: number }[]
  centroidTopic?: string
  color: string
}

const CLUSTER_COLORS = [
  '#9B8FF5', '#4ECDC4', '#E8705A', '#C9A96E', '#6BCB77',
  '#F7B731', '#A29BFE', '#FD79A8', '#00CEC9', '#E17055',
]

export async function GET() {
  try {
    await connectDB()

    const signals = await SignalModel.find(
      { embedding: { $exists: true, $not: { $size: 0 } } },
      { _id: 1, title: 1, type: 1, topics: 1, tags: 1, embedding: 1 }
    )
      .sort({ createdAt: -1 })
      .limit(200)
      .lean()

    if (signals.length < 2) {
      return NextResponse.json({ clusters: [] })
    }

    // Strategy 1: Group by primary topic using plain object
    const topicMap: Record<string, any[]> = {}
    const noTopic: any[] = []

    for (const s of signals) {
      const topic = ((s.topics as string[]) ?? [])[0]
      if (topic) {
        if (!topicMap[topic]) topicMap[topic] = []
        topicMap[topic].push(s)
      } else {
        noTopic.push(s)
      }
    }

    // Strategy 2: Greedy similarity clustering for uncategorized signals
    const SIMILARITY_THRESHOLD = 0.65
    const embeddingClusters: any[][] = []
    const assigned = new Set<string>()

    for (const seed of noTopic) {
      const seedId = String(seed._id)
      if (assigned.has(seedId)) continue
      const cluster: any[] = [seed]
      assigned.add(seedId)

      for (const other of noTopic) {
        const otherId = String(other._id)
        if (assigned.has(otherId)) continue
        const sim = cosineSimilarity(seed.embedding as number[], other.embedding as number[])
        if (sim >= SIMILARITY_THRESHOLD) {
          cluster.push(other)
          assigned.add(otherId)
        }
      }

      if (cluster.length >= 2) {
        embeddingClusters.push(cluster)
      }
    }

    // Build final cluster list
    const clusters: Cluster[] = []
    let colorIdx = 0

    // Topic-based clusters
    const topicKeys = Object.keys(topicMap)
    for (let i = 0; i < topicKeys.length; i++) {
      const topic = topicKeys[i]
      const sigs = topicMap[topic]
      if (!sigs || sigs.length < 1) continue
      clusters.push({
        id: `topic-${topic}`,
        name: topic,
        centroidTopic: topic,
        color: CLUSTER_COLORS[colorIdx++ % CLUSTER_COLORS.length],
        signals: sigs.slice(0, 20).map((s: any) => ({
          _id: String(s._id),
          title: String(s.title).slice(0, 60),
          type: String(s.type),
          score: 1.0,
        })),
      })
    }

    // Embedding-based clusters
    for (let i = 0; i < embeddingClusters.length; i++) {
      const group = embeddingClusters[i]
      // Find most common tag for cluster name
      const tagCounts: Record<string, number> = {}
      for (const s of group) {
        for (const tag of ((s.tags as string[]) ?? [])) {
          tagCounts[tag] = (tagCounts[tag] ?? 0) + 1
        }
      }
      const entries = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])
      const topTag = entries[0]?.[0] ?? `Cluster ${i + 1}`

      clusters.push({
        id: `embed-${i}`,
        name: topTag,
        color: CLUSTER_COLORS[colorIdx++ % CLUSTER_COLORS.length],
        signals: group.slice(0, 20).map((s: any) => ({
          _id: String(s._id),
          title: String(s.title).slice(0, 60),
          type: String(s.type),
          score: 0.8,
        })),
      })
    }

    clusters.sort((a, b) => b.signals.length - a.signals.length)
    return NextResponse.json({ clusters: clusters.slice(0, 12) })
  } catch (e: any) {
    console.error('Cluster error:', e)
    return NextResponse.json({ clusters: [], error: e?.message }, { status: 500 })
  }
}
