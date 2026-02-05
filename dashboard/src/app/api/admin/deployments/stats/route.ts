import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

// GET /api/admin/deployments/stats - Get deployment statistics
export async function GET() {
  try {
    // Get pending approvals count
    const [pendingApprovals] = await sql`
      SELECT COUNT(*) as count
      FROM approval_requests
      WHERE status = 'pending'
      AND (expires_at IS NULL OR expires_at > NOW())
    `

    // Get active deployments count (current production for each agent)
    const [activeDeployments] = await sql`
      SELECT COUNT(DISTINCT pv.agent_id) as count
      FROM deployments d
      JOIN prompt_versions pv ON d.prompt_version_id = pv.id
      WHERE d.rolled_back_at IS NULL
      AND (d.status = 'active' OR d.status IS NULL)
    `

    // Get regressions detected today
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [regressionsToday] = await sql`
      SELECT COUNT(*) as count
      FROM regression_reports
      WHERE detected = true
      AND evaluated_at >= ${today}
    `

    return NextResponse.json({
      pendingApprovals: Number(pendingApprovals.count),
      activeDeployments: Number(activeDeployments.count),
      regressionsToday: Number(regressionsToday.count),
    })
  } catch (error) {
    console.error('Failed to fetch deployment stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch deployment stats' },
      { status: 500 }
    )
  }
}
