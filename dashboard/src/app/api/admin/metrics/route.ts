import { NextRequest, NextResponse } from 'next/server'
import { calculateSystemMetrics } from '@/lib/metrics'
import { TimeRange } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const timeRange = (searchParams.get('timeRange') as TimeRange) || '7d'

    const metrics = await calculateSystemMetrics(timeRange)
    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Metrics error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch system metrics' },
      { status: 500 }
    )
  }
}
