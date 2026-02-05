import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { z } from 'zod'

const createPromptSchema = z.object({
  agent_name: z.string(),
  prompt_template: z.string(),
  parent_version_id: z.string().optional(),
  branch_name: z.string().default('main'),
  created_by: z.string(),
  training_config: z.record(z.any()).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const agentName = searchParams.get('agent_name')
    const branchName = searchParams.get('branch_name')
    const isActive = searchParams.get('is_active')

    let query = sql`
      SELECT * FROM prompt_versions
      WHERE 1=1
    `

    if (agentName) {
      query = sql`${query} AND agent_name = ${agentName}`
    }

    if (branchName) {
      query = sql`${query} AND branch_name = ${branchName}`
    }

    if (isActive !== null) {
      query = sql`${query} AND is_active = ${isActive === 'true'}`
    }

    query = sql`${query} ORDER BY created_at DESC`

    const versions = await query

    return NextResponse.json({ versions })
  } catch (error) {
    console.error('Failed to fetch prompt versions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch prompt versions' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = createPromptSchema.parse(body)

    // Get next version number
    const [{ max_version }] = await sql`
      SELECT COALESCE(MAX(version_number), 0) as max_version
      FROM prompt_versions
      WHERE agent_name = ${validated.agent_name}
      AND branch_name = ${validated.branch_name}
    `

    const nextVersion = (max_version || 0) + 1

    const [version] = await sql`
      INSERT INTO prompt_versions (
        agent_name,
        version_number,
        prompt_template,
        parent_version_id,
        branch_name,
        is_active,
        created_at,
        created_by,
        training_config
      ) VALUES (
        ${validated.agent_name},
        ${nextVersion},
        ${validated.prompt_template},
        ${validated.parent_version_id || null},
        ${validated.branch_name},
        false,
        NOW(),
        ${validated.created_by},
        ${JSON.stringify(validated.training_config || {})}
      )
      RETURNING *
    `

    return NextResponse.json({ version }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Failed to create prompt version:', error)
    return NextResponse.json(
      { error: 'Failed to create prompt version' },
      { status: 500 }
    )
  }
}
