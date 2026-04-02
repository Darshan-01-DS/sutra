import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/mongodb'
import { DocumentChunkModel } from '@/lib/models/DocumentChunk'
import SignalModel from '@/lib/models/Signal'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// ── Text chunking ────────────────────────────────────────────────────────────

function chunkText(text: string, chunkSize = 800, overlap = 150): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  let i = 0
  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(' ')
    if (chunk.trim()) chunks.push(chunk)
    i += chunkSize - overlap
  }
  return chunks
}

// ── Embedding logic ──────────────────────────────────────────────────────────

async function embedText(text: string, apiKey: string, provider: string, baseUrl?: string): Promise<number[]> {
  try {
    if (provider === 'gemini') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: { parts: [{ text }] },
        }),
      })
      if (!res.ok) throw new Error(`Gemini Embedding error: ${res.statusText}`)
      const data = await res.json()
      return data.embedding?.values ?? []
    } else if (provider === 'openrouter') {
      const url = baseUrl || 'https://openrouter.ai/api/v1'
      const res = await fetch(`${url}/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ input: text, model: 'openai/text-embedding-3-small' }),
      })
      if (!res.ok) throw new Error(`OpenRouter Embedding error: ${res.statusText}`)
      const data = await res.json()
      return data.data?.[0]?.embedding ?? []
    } else {
      // OpenAI / compatible
      const url = baseUrl ? `${baseUrl}/embeddings` : 'https://api.openai.com/v1/embeddings'
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ input: text, model: 'text-embedding-3-small' }),
      })
      if (!res.ok) throw new Error(`OpenAI Embedding error: ${res.statusText}`)
      const data = await res.json()
      return data.data?.[0]?.embedding ?? []
    }
  } catch (e: any) {
    console.error('[embedText] Error:', e.message)
    return []
  }
}

// ── POST /api/documents/process ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'You must be signed in to process documents. Please sign in and try again.' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    let body: any = {}
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { signalId, apiKey, provider } = body

    if (!signalId) {
      return NextResponse.json({ error: 'signalId is required' }, { status: 400 })
    }

    // Determine API key and provider
    const targetApiKey = apiKey || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY
    const targetProvider = apiKey ? (provider || 'openai') : (process.env.OPENROUTER_API_KEY ? 'openrouter' : 'openai')
    const targetBaseUrl = body.baseUrl || undefined

    if (!targetApiKey) {
      return NextResponse.json({
        error: 'No AI API key configured. Please add your OpenAI API key in Account Settings to process PDFs.',
      }, { status: 400 })
    }

    await connectDB()

    // Fetch signal and verify ownership
    const signal = await SignalModel.findOne({ _id: signalId, userId }).lean() as any
    if (!signal) {
      return NextResponse.json({ error: 'Signal not found or you do not have permission to access it.' }, { status: 404 })
    }
    if (signal.type !== 'pdf') {
      return NextResponse.json({ error: 'This signal is not a PDF. Only PDF signals can be processed.' }, { status: 400 })
    }

    // Already processed? Return cached result
    const existing = await DocumentChunkModel.countDocuments({ signalId: String(signal._id), userId })
    if (existing > 0) {
      return NextResponse.json({ success: true, chunks: existing, cached: true, message: 'Already processed' })
    }

    // Fetch PDF
    const pdfUrl: string = signal.fileUrl ?? signal.url
    if (!pdfUrl) {
      return NextResponse.json({ error: 'No PDF file URL found on this signal.' }, { status: 400 })
    }

    let pdfBuffer: Buffer
    try {
      const pdfRes = await fetch(pdfUrl, {
        headers: { 'User-Agent': 'SutraBot/1.0' },
        signal: AbortSignal.timeout(30000),
      })
      if (!pdfRes.ok) throw new Error(`HTTP ${pdfRes.status}: ${pdfRes.statusText}`)
      pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())
    } catch (e: any) {
      return NextResponse.json({ error: `Could not fetch the PDF file: ${e.message}` }, { status: 502 })
    }

    // Extract text
    let rawText = ''
    try {
      const pdfParse = require('pdf-parse')
      const parseFn = pdfParse.default || pdfParse
      const pdfData = await parseFn(pdfBuffer, { max: 0 })
      rawText = pdfData.text?.trim() ?? ''
    } catch (e: any) {
      return NextResponse.json({
        error: 'Failed to extract text from PDF. The file may be corrupted, image-only, or password-protected.',
      }, { status: 422 })
    }

    if (!rawText || rawText.length < 20) {
      return NextResponse.json({
        error: 'This PDF appears to contain no extractable text (possibly scanned/image-only). OCR is not yet supported.',
      }, { status: 422 })
    }

    // Chunk and embed
    const chunks = chunkText(rawText, 800, 150)
    if (!chunks.length) {
      return NextResponse.json({ error: 'No text chunks could be generated from this PDF.' }, { status: 422 })
    }

    const BATCH = 5
    const docs = []
    let embedFailures = 0

    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH)
      const embeddings = await Promise.all(
        batch.map(c => embedText(c, targetApiKey, targetProvider, targetBaseUrl).catch(() => []))
      )
      for (let j = 0; j < batch.length; j++) {
        if (!embeddings[j].length) { embedFailures++; continue }
        docs.push({
          userId,
          signalId: String(signal._id),
          documentName: signal.title ?? signal.fileName ?? 'Untitled PDF',
          chunkIndex: i + j,
          text: batch[j],
          embedding: embeddings[j],
          metadata: {
            fileName: signal.fileName ?? signal.title ?? 'document.pdf',
            uploadDate: signal.createdAt ?? new Date(),
          },
        })
      }
    }

    if (!docs.length) {
      return NextResponse.json({
        error: 'Failed to generate embeddings. Please check your API key or try again.',
      }, { status: 500 })
    }

    await DocumentChunkModel.insertMany(docs)
    await SignalModel.updateOne({ _id: signalId }, { $set: { embeddingStatus: 'done' } })

    return NextResponse.json({
      success: true,
      chunks: docs.length,
      skipped: embedFailures,
      documentName: docs[0]?.documentName,
    })
  } catch (e: any) {
    console.error('[/api/documents/process]', e)
    return NextResponse.json({
      error: e.message ?? 'Processing failed unexpectedly. Please try again.',
    }, { status: 500 })
  }
}
