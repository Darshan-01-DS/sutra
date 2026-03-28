import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IUserUsage extends Document {
  userId: string
  date: string // 'YYYY-MM-DD'
  queryCount: number
  processCount: number
  createdAt: Date
  updatedAt: Date
}

const UserUsageSchema = new Schema<IUserUsage>(
  {
    userId: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true },
    queryCount: { type: Number, default: 0 },
    processCount: { type: Number, default: 0 },
  },
  { timestamps: true }
)

// Ensure uniqueness per user per day
UserUsageSchema.index({ userId: 1, date: 1 }, { unique: true })

export const UserUsageModel: Model<IUserUsage> =
  mongoose.models.UserUsage ??
  mongoose.model<IUserUsage>('UserUsage', UserUsageSchema)
