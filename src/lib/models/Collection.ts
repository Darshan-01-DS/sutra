// src/lib/models/Collection.ts
import mongoose, { Schema, Model } from 'mongoose'

const CollectionSchema = new Schema(
  {
    name:        { type: String, required: true, maxlength: 100 },
    description: { type: String, maxlength: 500 },
    signalIds:   { type: [Schema.Types.ObjectId], ref: 'Signal', default: [] },
    sortIndex:   { type: Number, default: 0, index: true },
    color:       { type: String, default: '#C9A96E' },
    icon:        { type: String, default: '◈' },
  },
  { timestamps: true }
)

export const CollectionModel: Model<any> =
  (mongoose.models?.['Collection'] as Model<any>) ?? mongoose.model('Collection', CollectionSchema)

// src/lib/models/Activity — we inline it here too
const ActivitySchema = new Schema(
  {
    type:        { type: String, enum: ['saved','tagged','linked','viewed','highlighted','cluster_grew'], required: true },
    message:     { type: String, required: true },
    signalId:    { type: Schema.Types.ObjectId, ref: 'Signal' },
    signalTitle: { type: String },
    color:       { type: String, default: '#C9A96E' },
  },
  { timestamps: true }
)

export const ActivityModel: Model<any> =
  (mongoose.models?.['Activity'] as Model<any>) ?? mongoose.model('Activity', ActivitySchema)
