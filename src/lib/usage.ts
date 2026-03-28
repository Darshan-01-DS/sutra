import { connectDB } from './mongodb'
import { UserUsageModel } from './models/UserUsage'

export async function checkDailyLimit(userId: string, type: 'query' | 'process', limit: number = 30): Promise<{ ok: boolean; remaining: number }> {
  await connectDB()
  
  const today = new Date().toISOString().split('T')[0] // local time string date 'YYYY-MM-DD'
  const usage = await UserUsageModel.findOne({ userId, date: today })
  
  const count = usage ? (type === 'query' ? usage.queryCount : usage.processCount) : 0
  
  return {
    ok: count < limit,
    remaining: Math.max(0, limit - count)
  }
}

export async function incrementUsage(userId: string, type: 'query' | 'process') {
  await connectDB()
  
  const today = new Date().toISOString().split('T')[0]
  const update = type === 'query' ? { $inc: { queryCount: 1 } } : { $inc: { processCount: 1 } }
  
  await UserUsageModel.findOneAndUpdate(
    { userId, date: today },
    update,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
}
