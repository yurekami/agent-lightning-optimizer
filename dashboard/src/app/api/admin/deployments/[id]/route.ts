import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/admin/deployments/[id] - Get deployment details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const [deployment] = await sql`
      SELECT
        d.id,
        d.prompt_version_id as "versionId",
        pv.agent_id as "agentId",
        d.deployed_by as "deployedBy",
        deployer.name as "deployedByName",
        d.deployed_at as "deployedAt",
        COALESCE(d.status, 'active') as status,
        d.previous_deployment_id as "previousDeploymentId",
        d.metrics_before as "metricsBaseline",
        d.metrics_after as "metricsPostDeployment",
        d.regression_detected as "regressionDetected",
        d.rolled_back_at as "rolledBackAt",
        d.rolled_back_by as "rolledBackBy",
        rollbacker.name as "rolledBackByName",
        d.rollback_reason as "rollbackReason",
        pv.version
      FROM deployments d
      JOIN prompt_versions pv ON d.prompt_version_id = pv.id
      JOIN reviewers deployer ON d.deployed_by = deployer.id
      LEFT JOIN reviewers rollbacker ON d.rolled_back_by = rollbacker.id
      WHERE d.id = ${id}
    `

    if (!deployment) {
      return NextResponse.json(
        { error: 'Deployment not found' },
        { status: 404 }
      )
    }

    // Get regression report
    const [regressionReport] = await sql`
      SELECT
        deployment_id as "deploymentId",
        detected,
        severity,
        metrics,
        recommendations,
        evaluated_at as "evaluatedAt",
        auto_rollback_triggered as "autoRollbackTriggered"
      FROM regression_reports
      WHERE deployment_id = ${id}
      ORDER BY evaluated_at DESC
      LIMIT 1
    `

    return NextResponse.json({
      deployment,
      regressionReport: regressionReport || null,
    })
  } catch (error) {
    console.error('Failed to fetch deployment:', error)
    return NextResponse.json(
      { error: 'Failed to fetch deployment' },
      { status: 500 }
    )
  }
}
