// src/lib/similarity.ts
import { Signal } from '@/types'

export interface SimilarityScore {
  signalA:  string      // Signal ID
  signalB:  string      // Signal ID
  score:    number      // 0.0 – 1.0
  strength: 'strong' | 'medium' | 'weak'
  reasons:  string[]    // why they're connected
}

export function computeSimilarity(a: Signal, b: Signal): SimilarityScore | null {
  let score = 0
  const reasons: string[] = []

  // ── 1. SEMANTIC (embedding cosine similarity) — weight: 50%
  if (a.embedding?.length && b.embedding?.length) {
    const cos = cosineSimilarity(a.embedding, b.embedding)
    // Only count if meaningfully similar
    if (cos > 0.45) {
      score += cos * 0.5
      reasons.push('semantically similar content')
    }
  }

  // ── 2. TAG OVERLAP — weight: 30%
  // ANY shared tag counts, not requiring all tags to match
  const tagsA = new Set((a.tags || []).map(t => t.toLowerCase()))
  const tagsB = new Set((b.tags || []).map(t => t.toLowerCase()))
  const sharedTags = Array.from(tagsA).filter(t => tagsB.has(t))
  if (sharedTags.length > 0) {
    // Jaccard similarity: intersection / union
    const unionSize = new Set([...Array.from(tagsA), ...Array.from(tagsB)]).size
    const jaccard = sharedTags.length / unionSize
    score += jaccard * 0.30
    reasons.push(`shared tags: ${sharedTags.slice(0, 3).join(', ')}`)
  }

  // ── 3. TOPIC OVERLAP — weight: 15%
  const topicsA = new Set((a.topics || []).map(t => t.toLowerCase()))
  const topicsB = new Set((b.topics || []).map(t => t.toLowerCase()))
  const sharedTopics = Array.from(topicsA).filter(t => topicsB.has(t))
  if (sharedTopics.length > 0) {
    score += (sharedTopics.length / Math.max(topicsA.size, topicsB.size, 1)) * 0.15
    reasons.push(`same topic: ${sharedTopics[0]}`)
  }

  // ── 4. SAME SOURCE DOMAIN — weight: 5%
  if (a.source && b.source && a.source === b.source) {
    score += 0.05
    reasons.push('same source')
  }

  // Only create edge if meaningful connection
  if (score < 0.15) return null

  const strength: 'strong' | 'medium' | 'weak' =
    score >= 0.60 ? 'strong' :
    score >= 0.35 ? 'medium' : 'weak'

  return { signalA: String(a._id), signalB: String(b._id), score, strength, reasons }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  const mag = Math.sqrt(magA) * Math.sqrt(magB)
  return mag === 0 ? 0 : dot / mag
}
