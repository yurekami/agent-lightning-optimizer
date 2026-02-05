import { NextRequest, NextResponse } from 'next/server'
import { sql, testConnection } from '@/lib/db'
import { calculateSystemMetrics } from '@/lib/metrics'
import { TimeRange } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const isConnected = await testConnection()

    if (!isConnected) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const timeRange = (searchParams.get('timeRange') as TimeRange) || '7d'

    const metrics = await calculateSystemMetrics(timeRange)

    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Admin metrics error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch admin metrics' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === 'init_db') {
      return NextResponse.json({
        message: 'Database initialization not yet implemented',
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Admin action error:', error)
    return NextResponse.json(
      { error: 'Failed to execute admin action' },
      { status: 500 }
    )
  }
}
