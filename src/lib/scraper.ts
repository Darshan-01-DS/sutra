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
  content?: string
}

export interface AIConfig {
  key?: string
  provider?: string
  baseUrl?: string
  model?: string
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

function detectType(url: string, contentType?: string): SignalType {
  const normalized = url.toLowerCase()
  const lowerContentType = contentType?.toLowerCase()

  if (normalized.includes('twitter.com') || normalized.includes('x.com')) return 'tweet'
  if (normalized.includes('youtube.com') || normalized.includes('youtu.be') || normalized.includes('vimeo.com')) return 'video'
  if (normalized.endsWith('.pdf') || lowerContentType?.includes('pdf')) return 'pdf'
  if (normalized.match(/\.(png|jpg|jpeg|gif|webp|svg|avif)$/) || lowerContentType?.startsWith('image/')) return 'image'
  if (lowerContentType?.startsWith('video/')) return 'video'
  return 'article'
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function takePreview(text: string, maxLength = 2400): string {
  return normalizeWhitespace(text).slice(0, maxLength)
}

function stripUnsafeCharacters(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\uFFFD/g, ' ')
}

function looksLikeCorruptedText(text: string): boolean {
  if (!text.trim()) return false

  const sample = text.slice(0, 2500)
  const replacementCount = (sample.match(/\uFFFD/g) ?? []).length
  const binaryHeaderPattern = /(JFIF|Exif|PNG|IHDR|WEBP|RIFF|ftyp|PK\u0003\u0004)/
  const strangeControlCount = (sample.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g) ?? []).length

  return binaryHeaderPattern.test(sample) || replacementCount > 12 || strangeControlCount > 8
}

export function sanitizeExtractedText(text: string | undefined, maxLength = 4000): string | undefined {
  if (!text) return undefined

  const cleaned = takePreview(stripUnsafeCharacters(text), maxLength)
  if (!cleaned) return undefined
  if (looksLikeCorruptedText(cleaned)) return undefined

  return cleaned
}

function heuristicSummary(title: string, content?: string): string | undefined {
  const normalized = sanitizeExtractedText(content, 420)
  if (!normalized) return undefined

  const sentences = normalized.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 2)
  const body = sentences.length ? sentences.join(' ') : normalized
  return `${title}: ${body}`.slice(0, 420)
}

function isBinaryLikeContentType(contentType: string): boolean {
  const normalized = contentType.toLowerCase()
  if (!normalized) return false
  if (normalized.startsWith('text/')) return false
  if (normalized.includes('json') || normalized.includes('xml') || normalized.includes('javascript') || normalized.includes('html')) return false
  return normalized.startsWith('image/') || normalized.startsWith('audio/') || normalized.startsWith('video/') || normalized.includes('octet-stream') || normalized.includes('zip') || normalized.includes('msword') || normalized.includes('spreadsheet') || normalized.includes('presentation')
}

export async function generateSummary(title: string, content?: string, ai?: AIConfig): Promise<string | undefined> {
  const safeContent = sanitizeExtractedText(content, 5000)
  const fallback = heuristicSummary(title, safeContent)
  const key = ai?.key ?? process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY
  if (!key || !safeContent?.trim()) return fallback

  const baseUrl = ai?.baseUrl || 'https://openrouter.ai/api/v1'
  const model = ai?.model || 'openai/gpt-4o-mini'

  try {
    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: key, baseURL: baseUrl })
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'Write a crisp 2-3 sentence knowledge summary for a PKMS entry. Keep it factual, dense, and directly useful.'
        },
        {
          role: 'user',
          content: `Title: ${title}\n\nContent:\n${safeContent}`
        }
      ],
      max_tokens: 180,
      temperature: 0.2,
    })

    const summary = response.choices[0]?.message?.content?.trim()
    return summary || fallback
  } catch (error: any) {
    console.warn('generateSummary failed:', error.message)
    return fallback
  }
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
    const normalizedType = contentType.toLowerCase()

    if (normalizedType.includes('pdf')) {
      return {
        title: url.split('/').pop() ?? 'Document',
        source: domain,
        type: 'pdf',
        content: undefined,
      }
    }

    if (isBinaryLikeContentType(normalizedType)) {
      const detectedType = detectType(url, normalizedType)
      return {
        title: url.split('/').pop() ?? domain,
        source: domain,
        type: detectedType,
        thumbnail: detectedType === 'image' ? url : undefined,
        description: detectedType === 'image' ? 'Saved image asset' : 'Saved media asset',
        content: undefined,
      }
    }

    const html = await res.text()
    const sanitizedHtmlPreview = sanitizeExtractedText(html, 1000)
    if (!normalizedType.includes('html') && !sanitizedHtmlPreview) {
      return {
        title: url.split('/').pop() ?? domain,
        source: domain,
        type: detectType(url, normalizedType),
        content: undefined,
      }
    }

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

    const articleText =
      $('article').text() ||
      $('main').text() ||
      $('.post-content, .entry-content, .article-content, .markdown-body').text() ||
      $('body').text()

    const cleanedArticleText = sanitizeExtractedText(articleText, 4000)
    const cleanedDescription = sanitizeExtractedText(description, 500)
    const wordCount = normalizeWhitespace(articleText).split(' ').filter(Boolean).length
    const readTime = wordCount > 200 ? `${Math.ceil(wordCount / 200)} min read` : undefined

    return {
      title: title.trim().slice(0, 300),
      description: cleanedDescription,
      thumbnail: thumbnail || undefined,
      source: domain,
      type: detectType(url, contentType),
      readTime,
      content: cleanedArticleText || cleanedDescription,
    }
  } catch {
    return {
      title: getDomain(url),
      source: domain,
      type,
      content: undefined,
    }
  }
}

export async function autoTag(title: string, content?: string, ai?: AIConfig): Promise<{ tags: string[]; topics: string[] }> {
  const isSystemFallback = !ai?.key
  const key = ai?.key ?? process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY
  const safeContent = sanitizeExtractedText(content, 1200)

  if (!key) {
    return { tags: [], topics: [] }
  }

  const baseUrl = isSystemFallback ? 'https://openrouter.ai/api/v1' : (ai?.baseUrl || undefined)
  const model = isSystemFallback ? 'openai/gpt-4o-mini' : (ai?.model || 'gpt-4o-mini')
  const effectiveKey = ai?.provider === 'gemini' ? (process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY ?? key) : key
  const effectiveBaseUrl = ai?.provider === 'gemini' ? 'https://openrouter.ai/api/v1' : baseUrl
  const effectiveModel = ai?.provider === 'gemini' ? 'openai/gpt-4o-mini' : model

  try {
    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: effectiveKey, baseURL: effectiveBaseUrl })

    const prompt = `You are an expert knowledge curator. Analyze this saved content and categorize it precisely.

Return ONLY valid JSON with:
- "tags": 3-6 specific, lowercase keyword tags
- "topics": 1-3 broad categories in Title Case

Title: ${title}
${safeContent ? `Content: ${safeContent}` : ''}

JSON only:`

    const res = await openai.chat.completions.create({
      model: effectiveModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.15,
    })

    const text = res.choices[0].message.content ?? '{}'
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch (e: any) {
    console.warn('Scraper autoTag error:', e.message)
    return { tags: [], topics: [] }
  }
}

export async function getEmbedding(text: string): Promise<number[]> {
  return getEmbeddingWithKey(text)
}

export async function getEmbeddingWithKey(text: string, ai?: AIConfig): Promise<number[]> {
  const safeText = sanitizeExtractedText(text, 8000)
  const isSystemFallback = !ai?.key
  const key = ai?.key ?? process.env.GEMINI_API_KEY ?? process.env.OPENAI_API_KEY
  const provider = isSystemFallback ? 'gemini' : (ai?.provider ?? 'openai')

  if (!key || !safeText) return []

  try {
    if (provider === 'gemini') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'models/text-embedding-004', content: { parts: [{ text: safeText }] } }),
      })
      if (!res.ok) throw new Error(`Gemini Embedding error: ${res.statusText}`)
      const data = await res.json()
      return data.embedding.values
    }

    if (provider === 'openrouter') {
      const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ input: safeText, model: 'openai/text-embedding-3-small' }),
      })
      if (!res.ok) throw new Error(`OpenRouter Embedding error: ${res.statusText}`)
      const data = await res.json()
      return data.data[0].embedding
    }

    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: key, baseURL: ai?.baseUrl || undefined })
    const res = await openai.embeddings.create({ model: 'text-embedding-3-small', input: safeText })
    return res.data[0].embedding
  } catch (e: any) {
    console.error('getEmbedding error:', e.message)
    return []
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  return denom === 0 ? 0 : dot / denom
}

export function shouldResuface(lastViewed?: Date, createdAt?: Date): boolean {
  if (!createdAt) return false
  const now = Date.now()
  const created = new Date(createdAt).getTime()
  const daysOld = (now - created) / (1000 * 60 * 60 * 24)
  if (daysOld < 14) return false
  if (!lastViewed) return true
  const daysSinceView = (now - new Date(lastViewed).getTime()) / (1000 * 60 * 60 * 24)
  return daysSinceView > 7
}