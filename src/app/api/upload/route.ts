import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import SignalModel from '@/lib/models/Signal'
import { ActivityModel } from '@/lib/models/Collection'
import { uploadToImageKit } from '@/lib/imagekit'
import { autoTag, generateSummary, getEmbeddingWithKey, cosineSimilarity, sanitizeExtractedText, generateFullContentNote } from '@/lib/scraper'
import { SignalType } from '@/types'
import { initialSM2State } from '@/lib/sm2'
import { auth } from '@/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function detectSignalType(mimeType: string, fileName: string): SignalType {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) return 'pdf'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('text/')) return 'note'
  return 'link'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function toBase64DataUri(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

async function extractFileContent(file: File, buffer: Buffer, notes?: string | null): Promise<string | undefined> {
  try {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const pdfParse = require('pdf-parse')
      const parseFn = pdfParse.default || pdfParse
      const pdfData = await parseFn(buffer, { max: 0 })
      const text = sanitizeExtractedText(String(pdfData.text ?? ''), 12000)
      if (text) return text
    }

    if (file.type.startsWith('text/') || /\.(txt|md|csv|json)$/i.test(file.name)) {
      const text = sanitizeExtractedText(buffer.toString('utf8'), 12000)
      if (text) return text
    }
  } catch (error: any) {
    console.warn('File content extraction failed:', error.message)
  }

  if (notes?.trim()) return notes.trim()
  return `Uploaded ${file.name} (${formatSize(file.size)})`
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()

    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let fileUrl = ''
    let fileId = ''
    let thumbnailUrl = ''

    try {
      const uploaded = await uploadToImageKit(buffer, file.name)
      fileUrl = uploaded.url
      fileId = uploaded.fileId
      thumbnailUrl = uploaded.thumbnailUrl
    } catch (uploadErr: any) {
      console.warn('ImageKit upload failed, using Base64 fallback:', uploadErr.message)
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'File too large for fallback storage (max 5MB without ImageKit)' }, { status: 400 })
      }
      fileUrl = toBase64DataUri(buffer, file.type)
      fileId = `local_${Date.now()}`
      thumbnailUrl = file.type.startsWith('image/') ? fileUrl : ''
    }

    const signalType = detectSignalType(file.type, file.name)
    const notes = formData.get('notes') as string | null
    const aiConfig = {
      key: req.headers.get('x-openai-api-key') || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || undefined,
      provider: req.headers.get('x-openai-api-key') ? (req.headers.get('x-ai-provider') || undefined) : (process.env.GEMINI_API_KEY ? 'gemini' : undefined),
      baseUrl: req.headers.get('x-ai-base-url') || undefined,
      model: req.headers.get('x-ai-model') || undefined,
    }

    const extractedContent = await extractFileContent(file, buffer, notes)
    const rawContent = sanitizeExtractedText([
      extractedContent?.trim(),
      notes?.trim() && extractedContent?.trim() !== notes.trim() ? `User notes: ${notes.trim()}` : undefined,
    ].filter(Boolean).join('\n\n'), 12000) ?? `Uploaded ${file.name}`

    // Enhance content with AI
    const content = await generateFullContentNote(file.name, rawContent, aiConfig) || rawContent

    const summary = await generateSummary(file.name, content, aiConfig)
    const textForAI = sanitizeExtractedText(`${file.name}\n${summary ?? ''}\n${content}`.trim(), 12000) ?? `${file.name}\n${content}`

    let tags: string[] = []
    let topics: string[] = []
    let embedding: number[] = []

    try {
      const tagResult = await autoTag(file.name, content || summary, aiConfig)
      tags = tagResult.tags
      topics = tagResult.topics
    } catch (e: any) {
      console.warn('AutoTag upload failed:', e.message)
    }

    try {
      embedding = await getEmbeddingWithKey(textForAI, aiConfig)
    } catch (e: any) {
      console.warn('Embedding upload failed:', e.message)
    }

    const signalData: any = {
      userId,
      type: signalType,
      title: file.name,
      content,
      summary,
      source: 'upload',
      thumbnail: signalType === 'image' ? thumbnailUrl : undefined,
      fileUrl,
      fileId,
      fileSize: file.size,
      tags,
      topics,
      embedding,
    }

    if (embedding.length) {
      try {
        const allSignals = await SignalModel.find(
          { userId, embedding: { $exists: true, $not: { $size: 0 } } },
          { _id: 1, embedding: 1 }
        ).lean()

        const scored = allSignals
          .map(s => ({ id: s._id, score: cosineSimilarity(embedding, s.embedding ?? []) }))
          .filter(s => s.score > 0.75)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)

        signalData.relatedIds = scored.map(s => s.id)
      } catch {}
    }

    const sm2 = initialSM2State()
    signalData.sm2EaseFactor = sm2.easeFactor
    signalData.sm2Interval = sm2.interval
    signalData.sm2Repetitions = sm2.repetitions
    signalData.sm2NextReviewAt = sm2.nextReviewAt

    const signal = await SignalModel.create(signalData)

    if (signalData.embedding?.length && textForAI) {
      const { DocumentChunkModel } = await import('@/lib/models/DocumentChunk')
      await DocumentChunkModel.create({
        userId: signal.userId,
        signalId: String(signal._id),
        documentName: signal.title ?? 'Uploaded File',
        chunkIndex: 0,
        text: textForAI,
        embedding: signalData.embedding,
        metadata: {
          fileName: file.name,
          uploadDate: new Date(),
        }
      }).catch(err => console.warn('Global RAG index failed:', err.message))
    }

    await ActivityModel.create({
      type: 'saved',
      message: `Uploaded "${file.name.slice(0, 50)}"`,
      signalId: signal._id,
      signalTitle: signal.title,
      color: '#6BCB77',
    })

    if (tags.length) {
      await ActivityModel.create({
        type: 'tagged',
        message: `AI tagged "${file.name.slice(0, 40)}" -> ${tags.slice(0, 3).join(', ')}`,
        signalId: signal._id,
        signalTitle: signal.title,
        color: '#9B8FF5',
      })
    }

    return NextResponse.json({ ...signal.toJSON(), _id: String(signal._id) }, { status: 201 })
  } catch (e: any) {
    console.error('Upload error:', e)
    return NextResponse.json(
      { error: 'Failed to upload file', details: e?.message ? String(e.message) : 'Unknown error' },
      { status: 500 }
    )
  }
}