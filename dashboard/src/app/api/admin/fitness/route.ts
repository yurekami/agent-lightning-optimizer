import { NextRequest, NextResponse } from 'next/server'
import { calculateFitnessTrends } from '@/lib/metrics'
import { TimeRange } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    const timeRange = (searchParams.get('timeRange') as TimeRange) || '30d'

    if (!agentId) {
      return NextResponse.json(
        { error: 'agentId parameter is required' },
        { status: 400 }
      )
    }

    const trends = await calculateFitnessTrends(agentId, timeRange)
    return NextResponse.json(trends)
  } catch (error) {
    console.error('Fitness trends error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch fitness trends' },
      { status: 500 }
    )
  }
}
