import { NextRequest, NextResponse } from 'next/server'
import { calculateOverallReliability } from '@/lib/metrics'

export async function GET(request: NextRequest) {
  try {
    const reliability = await calculateOverallReliability()
    return NextResponse.json(reliability)
  } catch (error) {
    console.error('Reliability metrics error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reliability metrics' },
      { status: 500 }
    )
  }
}
