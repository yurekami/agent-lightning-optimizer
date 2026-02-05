import { NextRequest, NextResponse } from 'next/server'
import { calculateQueueHealth } from '@/lib/metrics'

export async function GET(request: NextRequest) {
  try {
    const queueHealth = await calculateQueueHealth()
    return NextResponse.json(queueHealth)
  } catch (error) {
    console.error('Queue health error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch queue health' },
      { status: 500 }
    )
  }
}
