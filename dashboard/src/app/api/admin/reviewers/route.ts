import { NextRequest, NextResponse } from 'next/server'
import { calculateReviewerStats } from '@/lib/metrics'

export async function GET(request: NextRequest) {
  try {
    const stats = await calculateReviewerStats()
    return NextResponse.json(stats)
  } catch (error) {
    console.error('Reviewer stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reviewer stats' },
      { status: 500 }
    )
  }
}
