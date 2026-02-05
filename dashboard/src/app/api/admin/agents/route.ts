import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { calculateAgentSummaries } from '@/lib/metrics'

// GET /api/admin/agents - List all agents with summaries
export async function GET() {
  try {
    const summaries = await calculateAgentSummaries()
    return NextResponse.json(summaries)
  } catch (error) {
    console.error('Failed to fetch agents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    )
  }
}

// POST /api/admin/agents - Create new agent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, basePrompt } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Agent name is required' },
        { status: 400 }
      )
    }

    // Create initial prompt version for the agent
    const [version] = await sql`
      INSERT INTO prompt_versions (
        agent_name,
        version_number,
        prompt_template,
        branch_name,
        is_active,
        created_by,
        training_config
      )
      VALUES (
        ${name},
        1,
        ${basePrompt || ''},
        'main',
        true,
        'system',
        ${JSON.stringify({ description })}
      )
      RETURNING id
    `

    return NextResponse.json({
      success: true,
      agentName: name,
      versionId: version.id,
    })
  } catch (error) {
    console.error('Create agent error:', error)
    return NextResponse.json(
      { error: 'Failed to create agent' },
      { status: 500 }
    )
  }
}
