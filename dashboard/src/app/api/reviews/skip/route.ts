import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { z } from 'zod'

const skipSchema = z.object({
  comparison_id: z.string(),
  reviewer_id: z.string(),
  reason: z.string(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = skipSchema.parse(body)

    // Parse comparison ID (format: "trajectoryA_id-trajectoryB_id")
    const [trajectory_a_id, trajectory_b_id] = validated.comparison_id.split('-')

    // Record the skip as a special type of feedback
    const [skip] = await sql`
      INSERT INTO comparison_feedback (
        reviewer_id,
        trajectory_a_id,
        trajectory_b_id,
        task_success_a,
        task_success_b,
        efficiency_a,
        efficiency_b,
        preference,
        comment,
        skip_reason,
        reviewed_at,
        metadata
      ) VALUES (
        ${validated.reviewer_id},
        ${trajectory_a_id},
        ${trajectory_b_id},
        false,
        false,
        0,
        0,
        'tie',
        '',
        ${validated.reason},
        NOW(),
        '{"skipped": true}'::jsonb
      )
      RETURNING *
    `

    return NextResponse.json({ skip }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Failed to skip comparison:', error)
    return NextResponse.json(
      { error: 'Failed to skip comparison' },
      { status: 500 }
    )
  }
}
