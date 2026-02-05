import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const reviewerId = searchParams.get('reviewer_id') || 'default-reviewer'
    const limit = parseInt(searchParams.get('limit') || '10', 10)

    // Get trajectory pairs that haven't been reviewed yet
    // This is a simplified version - in production, you'd have a comparison_pairs table
    const trajectories = await sql`
      SELECT
        t1.id as trajectory_a_id,
        t1.agent_name,
        t1.prompt_version_id as version_a,
        t1.session_id,
        t1.input_data,
        t1.started_at,
        t1.completed_at,
        t1.status,
        t1.metadata,
        t2.id as trajectory_b_id,
        t2.prompt_version_id as version_b
      FROM trajectories t1
      JOIN trajectories t2 ON
        t1.agent_name = t2.agent_name
        AND t1.id < t2.id
        AND t1.prompt_version_id != t2.prompt_version_id
      LEFT JOIN comparison_feedback cf ON
        (cf.trajectory_a_id = t1.id AND cf.trajectory_b_id = t2.id)
        OR (cf.trajectory_a_id = t2.id AND cf.trajectory_b_id = t1.id)
      WHERE
        cf.id IS NULL
        AND t1.status = 'completed'
        AND t2.status = 'completed'
      ORDER BY t1.started_at DESC
      LIMIT ${limit}
    `

    // Fetch full trajectory data for each pair
    const queue = await Promise.all(
      trajectories.map(async (pair: any) => {
        const [trajectoryA] = await sql`
          SELECT
            t.*,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', ts.id,
                  'trajectory_id', ts.trajectory_id,
                  'step_number', ts.step_number,
                  'prompt_text', ts.prompt_text,
                  'model_response', ts.model_response,
                  'thinking_trace', ts.thinking_trace,
                  'reward', ts.reward,
                  'timestamp', ts.timestamp,
                  'metadata', ts.metadata,
                  'tool_calls', COALESCE(
                    (SELECT json_agg(
                      json_build_object(
                        'tool_name', tc.tool_name,
                        'parameters', tc.parameters,
                        'result', tc.result,
                        'duration_ms', tc.duration_ms
                      )
                    )
                    FROM tool_calls tc
                    WHERE tc.step_id = ts.id),
                    '[]'::json
                  )
                )
                ORDER BY ts.step_number
              ) FILTER (WHERE ts.id IS NOT NULL),
              '[]'::json
            ) as steps
          FROM trajectories t
          LEFT JOIN trajectory_steps ts ON ts.trajectory_id = t.id
          WHERE t.id = ${pair.trajectory_a_id}
          GROUP BY t.id
        `

        const [trajectoryB] = await sql`
          SELECT
            t.*,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', ts.id,
                  'trajectory_id', ts.trajectory_id,
                  'step_number', ts.step_number,
                  'prompt_text', ts.prompt_text,
                  'model_response', ts.model_response,
                  'thinking_trace', ts.thinking_trace,
                  'reward', ts.reward,
                  'timestamp', ts.timestamp,
                  'metadata', ts.metadata,
                  'tool_calls', COALESCE(
                    (SELECT json_agg(
                      json_build_object(
                        'tool_name', tc.tool_name,
                        'parameters', tc.parameters,
                        'result', tc.result,
                        'duration_ms', tc.duration_ms
                      )
                    )
                    FROM tool_calls tc
                    WHERE tc.step_id = ts.id),
                    '[]'::json
                  )
                )
                ORDER BY ts.step_number
              ) FILTER (WHERE ts.id IS NOT NULL),
              '[]'::json
            ) as steps
          FROM trajectories t
          LEFT JOIN trajectory_steps ts ON ts.trajectory_id = t.id
          WHERE t.id = ${pair.trajectory_b_id}
          GROUP BY t.id
        `

        return {
          id: `${pair.trajectory_a_id}-${pair.trajectory_b_id}`,
          trajectoryA,
          trajectoryB,
          taskType: pair.agent_name,
          priority: 5,
          createdAt: pair.started_at,
        }
      })
    )

    return NextResponse.json({ queue })
  } catch (error) {
    console.error('Failed to fetch review queue:', error)
    return NextResponse.json(
      { error: 'Failed to fetch review queue' },
      { status: 500 }
    )
  }
}
