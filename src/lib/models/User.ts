import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IUser extends Document {
  name: string
  email: string
  password?: string
  image?: string
  provider: 'credentials' | 'google' | 'github'
  emailVerified?: Date
  openaiApiKey?: string
  aiEnabled: boolean
  accentColor: string
  defaultView: 'grid' | 'list' | 'graph'
  fontDensity: 'compact' | 'normal' | 'comfortable'
  resurfaceFreq: 'off' | 'daily' | 'weekly'
  plan: 'free' | 'pro'
  signalCount: number
  lastActiveAt?: Date
  loginAttempts: number
  lockUntil?: Date
  hasSeenOnboarding: boolean
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    name:            { type: String, required: true, maxlength: 100 },
    email:           { type: String, required: true, unique: true, lowercase: true, index: true },
    password:        { type: String, select: false },
    image:           { type: String },
    provider:        { type: String, enum: ['credentials','google','github'], default: 'credentials' },
    emailVerified:   { type: Date },

    // AI settings
    openaiApiKey:    { type: String },
    aiEnabled:       { type: Boolean, default: false },

    // Preferences (persisted)
    accentColor:     { type: String, default: '#C9A96E' },
    defaultView:     { type: String, enum: ['grid','list','graph'], default: 'grid' },
    fontDensity:     { type: String, enum: ['compact','normal','comfortable'], default: 'normal' },
    resurfaceFreq:   { type: String, enum: ['off','daily','weekly'], default: 'daily' },

    // Stats
    plan:            { type: String, enum: ['free','pro'], default: 'free' },
    signalCount:     { type: Number, default: 0 },
    lastActiveAt:    { type: Date },

    // Security
    loginAttempts:   { type: Number, default: 0 },
    lockUntil:       { type: Date },

    // Onboarding
    hasSeenOnboarding: { type: Boolean, default: false },
  },
  { timestamps: true }
)

const UserModel: Model<IUser> = (mongoose.models?.['User'] as Model<IUser>) ?? mongoose.model<IUser>('User', UserSchema)

export default UserModel
