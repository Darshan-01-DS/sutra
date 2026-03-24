import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'

export const dynamic = 'force-dynamic'
export const maxDuration = 10

export async function GET() {
  const start = Date.now()

  try {
    await connectDB()

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
      latency: `${Date.now() - start}ms`,
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown',
    }, { status: 503 })
  }
}
