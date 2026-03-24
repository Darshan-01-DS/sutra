// src/types/index.ts

export type SignalType = 'article' | 'tweet' | 'video' | 'pdf' | 'image' | 'note' | 'link'

export interface Signal {
  _id: string
  type: SignalType
  title: string
  url?: string
  content?: string
  source?: string        // domain name e.g. "paulgraham.com"
  thumbnail?: string     // og:image or screenshot url
  fileUrl?: string       // ImageKit CDN URL for uploaded files
  fileId?: string        // ImageKit file ID (for deletion)
  fileSize?: number      // file size in bytes
  summary?: string       // AI-generated summary
  tags: string[]
  topics: string[]
  embedding?: number[]   // vector for semantic search
  isFavorite: boolean
  viewCount: number
  highlights: Highlight[]
  relatedIds: string[]   // IDs of related signals
  collectionIds: string[]
  createdAt: string
  updatedAt: string
  lastViewedAt?: string
  readTime?: string      // "3 min read"
  duration?: string      // for videos "38 min"
  pageCount?: number     // for PDFs
  addedToResurface?: boolean
  resurfaceNote?: string
  resurfaceAt?: string
  resurfacedAt?: string
}

export interface Highlight {
  _id: string
  text: string
  note?: string
  color: string
  position: number
  createdAt: string
}

export interface Collection {
  _id: string
  name: string
  description?: string
  signalIds: string[]
  color: string
  icon: string
  createdAt: string
  updatedAt: string
}

export interface Topic {
  name: string
  count: number
  signals: string[]
  trend: 'growing' | 'stable' | 'shrinking'
}

export interface Activity {
  _id: string
  type: 'saved' | 'tagged' | 'linked' | 'viewed' | 'highlighted' | 'cluster_grew'
  message: string
  signalId?: string
  signalTitle?: string
  color: string
  createdAt: string
}

export interface GraphNode {
  id: string
  title: string
  type: SignalType
  tags: string[]
  x?: number
  y?: number
}

export interface GraphEdge {
  source: string
  target: string
  strength: number
}

export interface StatsData {
  total: number
  byType: Record<SignalType, number>
  thisWeek: number
  topics: Topic[]
  recentActivity: Activity[]
  resurface?: ResurfaceItem[]
}

export interface ResurfaceItem {
  signal: Signal
  reason: string
  daysAgo: number
}

export interface SearchResult {
  signal: Signal
  score: number
  matchType: 'semantic' | 'keyword' | 'tag'
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}
