// src/lib/scraper.ts
import * as cheerio from 'cheerio'
import { SignalType } from '@/types'

export interface ScrapedMeta {
  title: string
  description?: string
  thumbnail?: string
  source: string
  type: SignalType
  readTime?: string
  duration?: string
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

function detectType(url: string, contentType?: string): SignalType {
  const u = url.toLowerCase()
  if (u.includes('twitter.com') || u.includes('x.com')) return 'tweet'
  if (u.includes('youtube.com') || u.includes('youtu.be') || u.includes('vimeo.com')) return 'video'
  if (u.endsWith('.pdf') || contentType?.includes('pdf')) return 'pdf'
  if (u.match(/\.(png|jpg|jpeg|gif|webp|svg)$/)) return 'image'
  return 'article'
}

export async function scrapeUrl(url: string): Promise<ScrapedMeta> {
  const domain = getDomain(url)
  const type = detectType(url)

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Sutrabot/1.0)' },
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const contentType = res.headers.get('content-type') ?? ''
    if (contentType.includes('pdf')) {
      return { title: url.split('/').pop() ?? 'Document', source: domain, type: 'pdf' }
    }

    const html = await res.text()
    const $ = cheerio.load(html)

    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('title').text() ||
      url

    const description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      $('meta[name="twitter:description"]').attr('content') ||
      ''

    const thumbnail =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      ''

    // Estimate read time from article content
    const articleText = $('article, main, .post-content, .entry-content').text() || $('body').text()
    const wordCount = articleText.split(/\s+/).filter(Boolean).length
    const readTime = wordCount > 200 ? `${Math.ceil(wordCount / 200)} min read` : undefined

    return {
      title: title.trim().slice(0, 300),
      description: description.trim().slice(0, 500),
      thumbnail: thumbnail || undefined,
      source: domain,
      type: detectType(url, contentType),
      readTime,
    }
  } catch {
    return {
      title: getDomain(url),
      source: domain,
      type,
    }
  }
}

// ── AI TAGGING ──────────────────────────────────────────────────────────────

export interface AIConfig {
  key?: string
  provider?: string
  baseUrl?: string
  model?: string
}

export async function autoTag(title: string, content?: string, ai?: AIConfig): Promise<{ tags: string[]; topics: string[] }> {
  const key = ai?.key ?? process.env.OPENAI_API_KEY
  if (!key) {
    return { tags: [], topics: [] }
  }

  try {
    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ 
      apiKey: key,
      baseURL: ai?.baseUrl || undefined,
    })

    const prompt = `You are an expert knowledge curator. Analyze this saved content and categorize it precisely.

Return ONLY valid JSON with:
- "tags": 3-6 specific, lowercase keyword tags (e.g. "react-hooks", "gradient-descent", "api-design")
- "topics": 1-3 broad categories in Title Case (e.g. "Machine Learning", "Web Development", "Product Design")

Rules:
- Tags should be specific and searchable, not generic (avoid: "interesting", "good", "tech")
- Topics should be broad enough to group related signals together
- For uploaded files: infer the domain from the filename and content type

Title: ${title}
${content ? `Content: ${content.slice(0, 600)}` : ''}

JSON only:`

    const res = await openai.chat.completions.create({
      model: ai?.model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.15,
    })

    const text = res.choices[0].message.content ?? '{}'
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return { tags: [], topics: [] }
  }
}

// ── EMBEDDINGS for semantic search ──────────────────────────────────────────

export async function getEmbedding(text: string): Promise<number[]> {
  return getEmbeddingWithKey(text)
}

export async function getEmbeddingWithKey(text: string, ai?: AIConfig): Promise<number[]> {
  const key = ai?.key ?? process.env.OPENAI_API_KEY
  if (!key) return []

  try {
    if (ai?.provider === 'gemini') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: { parts: [{ text }] },
        }),
      })
      if (!res.ok) throw new Error(`Gemini Embedding error: ${res.statusText}`)
      const data = await res.json()
      return data.embedding.values
    } else if (ai?.provider === 'openrouter') {
      const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ input: text.slice(0, 8000), model: 'openai/text-embedding-3-small' }),
      })
      if (!res.ok) throw new Error(`OpenRouter Embedding error: ${res.statusText}`)
      const data = await res.json()
      return data.data[0].embedding
    } else {
      const { default: OpenAI } = await import('openai')
      const openai = new OpenAI({ 
        apiKey: key,
        baseURL: ai?.baseUrl || undefined
      })

      const res = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000),
      })
      return res.data[0].embedding
    }
  } catch (e: any) {
    console.error('getEmbedding error:', e.message)
    return []
  }
}

// ── COSINE SIMILARITY ────────────────────────────────────────────────────────

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

// ── RESURFACING LOGIC ────────────────────────────────────────────────────────

export function shouldResuface(lastViewed?: Date, createdAt?: Date): boolean {
  if (!createdAt) return false
  const now = Date.now()
  const created = new Date(createdAt).getTime()
  const daysOld = (now - created) / (1000 * 60 * 60 * 24)
  // resurface items that are 14+ days old and haven't been viewed recently
  if (daysOld < 14) return false
  if (!lastViewed) return true
  const daysSinceView = (now - new Date(lastViewed).getTime()) / (1000 * 60 * 60 * 24)
  return daysSinceView > 7
}
