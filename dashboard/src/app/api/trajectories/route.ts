import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { z } from 'zod'

const createTrajectorySchema = z.object({
  session_id: z.string(),
  agent_name: z.string(),
  prompt_version_id: z.string(),
  input_data: z.record(z.any()),
  metadata: z.record(z.any()).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const agentName = searchParams.get('agent_name')
    const status = searchParams.get('status')

    let query = sql`
      SELECT * FROM trajectories
      WHERE 1=1
    `

    if (agentName) {
      query = sql`${query} AND agent_name = ${agentName}`
    }

    if (status) {
      query = sql`${query} AND status = ${status}`
    }

    query = sql`${query} ORDER BY started_at DESC LIMIT 100`

    const trajectories = await query

    return NextResponse.json({ trajectories })
  } catch (error) {
    console.error('Failed to fetch trajectories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trajectories' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = createTrajectorySchema.parse(body)

    const [trajectory] = await sql`
      INSERT INTO trajectories (
        session_id,
        agent_name,
        prompt_version_id,
        input_data,
        started_at,
        status,
        metadata
      ) VALUES (
        ${validated.session_id},
        ${validated.agent_name},
        ${validated.prompt_version_id},
        ${JSON.stringify(validated.input_data)},
        NOW(),
        'running',
        ${JSON.stringify(validated.metadata || {})}
      )
      RETURNING *
    `

    return NextResponse.json({ trajectory }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Failed to create trajectory:', error)
    return NextResponse.json(
      { error: 'Failed to create trajectory' },
      { status: 500 }
    )
  }
}
