// src/lib/models/Signal.ts
import mongoose, { Schema, Document, Model } from 'mongoose'
import { SignalType } from '@/types'

export interface ISignal extends Document {
  userId: string
  type: SignalType
  title: string
  url?: string
  content?: string
  source?: string
  thumbnail?: string
  fileUrl?: string
  fileId?: string
  fileSize?: number
  summary?: string
  tags: string[]
  topics: string[]
  embedding: number[]
  isFavorite: boolean
  viewCount: number
  highlights: {
    text: string
    note?: string
    color: string
    position: number
    createdAt: Date
  }[]
  relatedIds: mongoose.Types.ObjectId[]
  collectionIds: mongoose.Types.ObjectId[]
  lastViewedAt?: Date
  readTime?: string
  duration?: string
  pageCount?: number
  // SM-2 spaced repetition
  sm2EaseFactor: number
  sm2Interval: number
  sm2Repetitions: number
  sm2NextReviewAt?: Date
  // Resurface queue
  addedToResurface: boolean
  resurfaceNote?: string
  resurfaceAt?: Date
  resurfacedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const HighlightSchema = new Schema({
  text:      { type: String, required: true },
  note:      { type: String },
  color:     { type: String, default: '#C9A96E' },
  position:  { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
})

const SignalSchema = new Schema<ISignal>(
  {
    userId:        { type: String, index: true },
    type:          { type: String, enum: ['article','tweet','video','pdf','image','note','link'], required: true },
    title:         { type: String, required: true, maxlength: 500 },
    url:           { type: String, index: true },
    content:       { type: String },
    source:        { type: String },
    thumbnail:     { type: String },
    fileUrl:       { type: String },
    fileId:        { type: String },
    fileSize:      { type: Number },
    summary:       { type: String },
    tags:          { type: [String], default: [], index: true },
    topics:        { type: [String], default: [] },
    embedding:     { type: [Number], default: [] },
    isFavorite:    { type: Boolean, default: false },
    viewCount:     { type: Number, default: 0 },
    highlights:    { type: [HighlightSchema], default: [] },
    relatedIds:    { type: [Schema.Types.ObjectId], ref: 'Signal', default: [] },
    collectionIds: { type: [Schema.Types.ObjectId], ref: 'Collection', default: [] },
    lastViewedAt:  { type: Date },
    readTime:      { type: String },
    duration:      { type: String },
    pageCount:     { type: Number },
    // SM-2 spaced repetition fields
    sm2EaseFactor:    { type: Number, default: 2.5 },
    sm2Interval:      { type: Number, default: 1 },
    sm2Repetitions:   { type: Number, default: 0 },
    sm2NextReviewAt:  { type: Date },
    // Resurface queue
    addedToResurface: { type: Boolean, default: false },
    resurfaceNote:    { type: String, maxlength: 300 },
    resurfaceAt:      { type: Date },
    resurfacedAt:     { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
)

SignalSchema.index({ topics: 1 })
SignalSchema.index({ type: 1 })
SignalSchema.index({ createdAt: -1 })
SignalSchema.index({ title: 'text', content: 'text', tags: 'text' })

const SignalModel: Model<ISignal> =
  (mongoose.models?.['Signal'] as Model<ISignal>) ?? mongoose.model<ISignal>('Signal', SignalSchema)

export default SignalModel
