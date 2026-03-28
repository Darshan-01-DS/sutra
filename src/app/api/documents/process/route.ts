// src/app/api/documents/process/route.ts
// Extracts text from a PDF signal, chunks it, embeds each chunk, stores in MongoDB
// Called automatically after PDF upload OR manually by the user

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectDB } from '@/lib/mongodb'
import { DocumentChunkModel } from '@/lib/models/DocumentChunk'
import SignalModel from '@/lib/models/Signal'

export const dynamic = 'force-dynamic'
export const maxDuration = 120  // PDF processing can be slow

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

// ── OpenAI embedding ─────────────────────────────────────────────────────────

async function embedText(text: string, apiKey: string, provider: string): Promise<number[]> {
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
    return data.embedding.values
  } else if (provider === 'openrouter') {
    const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ input: text, model: 'openai/text-embedding-3-small' }),
    })
    if (!res.ok) throw new Error(`OpenRouter Embedding error: ${res.statusText}`)
    const data = await res.json()
    return data.data[0].embedding
  } else {
    // Default: OpenAI
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ input: text, model: 'text-embedding-3-small' }),
    })
    if (!res.ok) throw new Error(`OpenAI Embedding error: ${res.statusText}`)
    const data = await res.json()
    return data.data[0].embedding
  }
}

// ── POST /api/documents/process ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { signalId, apiKey, provider } = await req.json()
    if (!signalId) return NextResponse.json({ error: 'signalId required' }, { status: 400 })
    if (!apiKey)   return NextResponse.json({ error: 'API key required'  }, { status: 400 })

    await connectDB()

    // 1. Fetch signal and verify ownership + type
    const signal = await SignalModel.findOne({ _id: signalId, userId: session.user.id }).lean() as any
    if (!signal) return NextResponse.json({ error: 'Signal not found' }, { status: 404 })
    if (signal.type !== 'pdf') return NextResponse.json({ error: 'Signal must be a PDF' }, { status: 400 })

    // 2. Already processed? Skip if chunks exist (idempotent)
    const existing = await DocumentChunkModel.countDocuments({ signalId, userId: session.user.id })
    if (existing > 0) {
      return NextResponse.json({ success: true, chunks: existing, cached: true })
    }

    // 3. Fetch the raw PDF file
    const pdfUrl: string = signal.fileUrl ?? signal.url
    if (!pdfUrl) return NextResponse.json({ error: 'No PDF URL on signal' }, { status: 400 })

    const pdfRes = await fetch(pdfUrl)
    if (!pdfRes.ok) return NextResponse.json({ error: 'Failed to fetch PDF' }, { status: 502 })

    // 4. Extract text with stable legacy pdf-parse@1.1.1
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())
    const pdfParse = require('pdf-parse')
    const parseFn = pdfParse.default || pdfParse
    const pdfData = await parseFn(pdfBuffer, { max: 0 })
    const rawText = pdfData.text?.trim() ?? ''

    if (!rawText || rawText.length < 50) {
      return NextResponse.json({ error: 'PDF appears to be empty or image-only (no extractable text)' }, { status: 422 })
    }

    // 5. Chunk the text
    const chunks = chunkText(rawText, 800, 150)
    if (chunks.length === 0) return NextResponse.json({ error: 'No text chunks generated' }, { status: 422 })

    // 6. Embed and store each chunk (batch in groups of 5 to avoid rate limits)
    const BATCH = 5
    const docs = []
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH)
      const embeddings = await Promise.all(batch.map(c => embedText(c, apiKey, provider)))
      for (let j = 0; j < batch.length; j++) {
        docs.push({
          userId:       session.user.id,
          signalId:     String(signal._id),
          documentName: signal.title ?? signal.fileName ?? 'Untitled PDF',
          chunkIndex:   i + j,
          text:         batch[j],
          embedding:    embeddings[j],
          metadata: {
            fileName:   signal.fileName ?? signal.title ?? 'document.pdf',
            uploadDate: signal.createdAt ?? new Date(),
          },
        })
      }
    }

    await DocumentChunkModel.insertMany(docs)

    // 7. Mark the signal as processed
    await SignalModel.updateOne({ _id: signalId }, { $set: { embeddingStatus: 'done' } })

    return NextResponse.json({ success: true, chunks: docs.length, documentName: docs[0]?.documentName })
  } catch (e: any) {
    console.error('[/api/documents/process]', e)
    return NextResponse.json({ error: e.message ?? 'Processing failed' }, { status: 500 })
  }
}
