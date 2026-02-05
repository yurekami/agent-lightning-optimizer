import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

// GET /api/admin/deployments/alerts - Get active deployment alerts
export async function GET() {
  try {
    const alerts = []

    // Get recent regressions (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const regressions = await sql`
      SELECT
        rr.id,
        rr.severity,
        rr.detected,
        rr.auto_rollback_triggered,
        rr.evaluated_at,
        d.id as deployment_id,
        pv.agent_id
      FROM regression_reports rr
      JOIN deployments d ON rr.deployment_id = d.id
      JOIN prompt_versions pv ON d.prompt_version_id = pv.id
      WHERE rr.detected = true
      AND rr.evaluated_at >= ${yesterday}
      AND d.rolled_back_at IS NULL
      ORDER BY rr.evaluated_at DESC
    `

    for (const reg of regressions) {
      alerts.push({
        id: `regression-${reg.id}`,
        type: 'regression',
        message: reg.auto_rollback_triggered
          ? 'Auto-rollback triggered due to critical regression'
          : 'Performance regression detected - review recommended',
        severity: reg.severity || 'medium',
        agentId: reg.agent_id,
        timestamp: reg.evaluated_at,
      })
    }

    // Get expiring approvals (within 24 hours)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const expiringApprovals = await sql`
      SELECT
        ar.id,
        ar.agent_id,
        ar.expires_at
      FROM approval_requests ar
      WHERE ar.status = 'pending'
      AND ar.expires_at IS NOT NULL
      AND ar.expires_at <= ${tomorrow}
      AND ar.expires_at > NOW()
    `

    for (const approval of expiringApprovals) {
      alerts.push({
        id: `expiring-${approval.id}`,
        type: 'pending_approval',
        message: 'Approval request expiring soon',
        severity: 'medium',
        agentId: approval.agent_id,
        timestamp: approval.expires_at,
      })
    }

    // Get recent rollbacks (last 24 hours)
    const rollbacks = await sql`
      SELECT
        d.id,
        d.rolled_back_at,
        d.rollback_reason,
        pv.agent_id
      FROM deployments d
      JOIN prompt_versions pv ON d.prompt_version_id = pv.id
      WHERE d.rolled_back_at IS NOT NULL
      AND d.rolled_back_at >= ${yesterday}
      ORDER BY d.rolled_back_at DESC
    `

    for (const rollback of rollbacks) {
      alerts.push({
        id: `rollback-${rollback.id}`,
        type: 'rollback',
        message: rollback.rollback_reason || 'Deployment was rolled back',
        severity: 'low',
        agentId: rollback.agent_id,
        timestamp: rollback.rolled_back_at,
      })
    }

    // Sort by severity (critical first) then by timestamp
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    alerts.sort((a, b) => {
      const severityDiff =
        (severityOrder[a.severity as keyof typeof severityOrder] || 3) -
        (severityOrder[b.severity as keyof typeof severityOrder] || 3)
      if (severityDiff !== 0) return severityDiff
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })

    return NextResponse.json(alerts)
  } catch (error) {
    console.error('Failed to fetch deployment alerts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch deployment alerts' },
      { status: 500 }
    )
  }
}
