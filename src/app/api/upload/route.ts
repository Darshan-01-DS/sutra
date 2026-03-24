// src/app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import SignalModel from '@/lib/models/Signal'
import { ActivityModel } from '@/lib/models/Collection'
import { uploadToImageKit } from '@/lib/imagekit'
import { autoTag, getEmbeddingWithKey, cosineSimilarity } from '@/lib/scraper'
import { SignalType } from '@/types'
import { initialSM2State } from '@/lib/sm2'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Map MIME types to signal types
function detectSignalType(mimeType: string, fileName: string): SignalType {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) return 'pdf'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('text/')) return 'note'
  return 'link'
}

// Format file size for display
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file size (max 25MB)
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 25MB)' }, { status: 400 })
    }

    // Convert File to Buffer for ImageKit
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to ImageKit
    const uploaded = await uploadToImageKit(buffer, file.name)

    const signalType = detectSignalType(file.type, file.name)
    const notes = formData.get('notes') as string | null
    const aiConfig = {
      key: req.headers.get('x-openai-api-key') ?? undefined,
      provider: req.headers.get('x-ai-provider') ?? undefined,
      baseUrl: req.headers.get('x-ai-base-url') ?? undefined,
      model: req.headers.get('x-ai-model') ?? undefined,
    }

    // AI auto-tag based on filename + type
    const textForAI = `File: ${file.name} (${signalType}, ${formatSize(file.size)})${notes ? '\n' + notes : ''}`
    const [{ tags, topics }, embedding] = await Promise.all([
      autoTag(file.name, `Uploaded ${signalType} file: ${file.name}${notes ? '. Notes: ' + notes : ''}`, aiConfig),
      getEmbeddingWithKey(textForAI, aiConfig),
    ])

    // Build signal data
    const contentParts = [`Uploaded file: ${file.name} (${formatSize(file.size)})`]
    if (notes) contentParts.push(`\n\n— User notes —\n${notes}`)

    const signalData: any = {
      type: signalType,
      title: file.name,
      content: contentParts.join(''),
      source: 'upload',
      thumbnail: signalType === 'image' ? uploaded.thumbnailUrl : undefined,
      fileUrl: uploaded.url,
      fileId: uploaded.fileId,
      fileSize: file.size,
      tags,
      topics,
      embedding,
    }

    // Find related signals
    if (embedding.length) {
      const allSignals = await SignalModel.find(
        { embedding: { $exists: true, $not: { $size: 0 } } },
        { _id: 1, embedding: 1 }
      ).lean()

      const scored = allSignals
        .map(s => ({ id: s._id, score: cosineSimilarity(embedding, s.embedding ?? []) }))
        .filter(s => s.score > 0.75)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)

      signalData.relatedIds = scored.map(s => s.id)
    }

    // Initialize SM-2 state
    const sm2 = initialSM2State()
    signalData.sm2EaseFactor = sm2.easeFactor
    signalData.sm2Interval = sm2.interval
    signalData.sm2Repetitions = sm2.repetitions
    signalData.sm2NextReviewAt = sm2.nextReviewAt

    const signal = await SignalModel.create(signalData)

    // Log activity
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
        message: `AI tagged "${file.name.slice(0, 40)}" → ${tags.slice(0, 3).join(', ')}`,
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
