import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { calculateReviewerStats } from '@/lib/metrics'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const stats = await calculateReviewerStats()
    const reviewer = stats.find((r) => r.id === params.id)

    if (!reviewer) {
      return NextResponse.json({ error: 'Reviewer not found' }, { status: 404 })
    }

    return NextResponse.json(reviewer)
  } catch (error) {
    console.error('Reviewer error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reviewer' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { name, email, role } = body

    await sql`
      UPDATE reviewers
      SET
        name = COALESCE(${name}, name),
        email = COALESCE(${email}, email),
        role = COALESCE(${role}, role)
      WHERE id = ${params.id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update reviewer error:', error)
    return NextResponse.json(
      { error: 'Failed to update reviewer' },
      { status: 500 }
    )
  }
}
