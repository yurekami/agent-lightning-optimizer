import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { z } from 'zod'

const submitFeedbackSchema = z.object({
  reviewer_id: z.string(),
  trajectory_a_id: z.string(),
  trajectory_b_id: z.string(),
  task_success_a: z.boolean(),
  task_success_b: z.boolean(),
  efficiency_a: z.number().min(1).max(5),
  efficiency_b: z.number().min(1).max(5),
  preference: z.enum(['A', 'B', 'tie']),
  comment: z.string(),
  skip_reason: z.string().optional(),
  metadata: z.record(z.any()).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const reviewerId = searchParams.get('reviewer_id')

    const feedback = await sql`
      SELECT
        cf.*,
        ta.agent_name as trajectory_a_agent,
        tb.agent_name as trajectory_b_agent
      FROM comparison_feedback cf
      JOIN trajectories ta ON cf.trajectory_a_id = ta.id
      JOIN trajectories tb ON cf.trajectory_b_id = tb.id
      ${reviewerId ? sql`WHERE cf.reviewer_id = ${reviewerId}` : sql``}
      ORDER BY cf.reviewed_at DESC
      LIMIT 100
    `

    return NextResponse.json({ feedback })
  } catch (error) {
    console.error('Failed to fetch feedback:', error)
    return NextResponse.json(
      { error: 'Failed to fetch feedback' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = submitFeedbackSchema.parse(body)

    const [feedback] = await sql`
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
        ${validated.trajectory_a_id},
        ${validated.trajectory_b_id},
        ${validated.task_success_a},
        ${validated.task_success_b},
        ${validated.efficiency_a},
        ${validated.efficiency_b},
        ${validated.preference},
        ${validated.comment},
        ${validated.skip_reason || null},
        NOW(),
        ${JSON.stringify(validated.metadata || {})}
      )
      RETURNING *
    `

    return NextResponse.json({ feedback }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Failed to submit feedback:', error)
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    )
  }
}
