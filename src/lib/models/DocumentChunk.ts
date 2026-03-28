// src/lib/models/DocumentChunk.ts
// MongoDB schema for PDF chunks + their embeddings (for Atlas Vector Search)

import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IDocumentChunk extends Document {
  userId: string
  signalId: string       // References the Signal this PDF belongs to
  documentName: string
  chunkIndex: number
  text: string
  embedding: number[]   // 1536-dim for text-embedding-3-small
  metadata: {
    fileName: string
    uploadDate: Date
    pageHint?: number
  }
  createdAt: Date
}

const DocChunkSchema = new Schema<IDocumentChunk>(
  {
    userId:       { type: String, required: true, index: true },
    signalId:     { type: String, required: true, index: true },
    documentName: { type: String, required: true },
    chunkIndex:   { type: Number, required: true },
    text:         { type: String, required: true },
    embedding:    { type: [Number], required: true },
    metadata: {
      fileName:   { type: String },
      uploadDate: { type: Date, default: Date.now },
      pageHint:   { type: Number },
    },
  },
  { timestamps: true }
)

// Compound index to quickly fetch all chunks for a signal
DocChunkSchema.index({ userId: 1, signalId: 1, chunkIndex: 1 })

export const DocumentChunkModel: Model<IDocumentChunk> =
  mongoose.models.DocumentChunk ??
  mongoose.model<IDocumentChunk>('DocumentChunk', DocChunkSchema)
