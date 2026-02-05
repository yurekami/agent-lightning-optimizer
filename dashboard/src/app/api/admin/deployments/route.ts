import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

interface DeploymentRow {
  id: string
  versionId: string
  agentId: string
  deployedBy: string
  deployedByName: string
  deployedAt: Date
  status: string
  previousDeploymentId: string | null
  metricsBaseline: unknown
  metricsPostDeployment: unknown
  regressionDetected: boolean
  rolledBackAt: Date | null
  rolledBackBy: string | null
  rolledBackByName: string | null
  rollbackReason: string | null
  version: number
}

interface RegressionReportRow {
  deploymentId: string
  detected: boolean
  severity: string | null
  recommendations: string[]
  evaluatedAt: Date
  autoRollbackTriggered: boolean
}

// GET /api/admin/deployments - List deployments
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    let deployments: (DeploymentRow & { regressionReport?: RegressionReportRow | null })[]

    if (agentId) {
      const rows = await sql`
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
        WHERE pv.agent_id = ${agentId}
        ORDER BY d.deployed_at DESC
        LIMIT ${limit}
      `
      deployments = rows as unknown as DeploymentRow[]

      // Get regression reports for each deployment
      const deploymentIds = deployments.map((d) => d.id)
      if (deploymentIds.length > 0) {
        const reports = await sql`
          SELECT
            deployment_id as "deploymentId",
            detected,
            severity,
            recommendations,
            evaluated_at as "evaluatedAt",
            auto_rollback_triggered as "autoRollbackTriggered"
          FROM regression_reports
          WHERE deployment_id = ANY(${deploymentIds})
        ` as unknown as RegressionReportRow[]

        const reportMap = new Map(reports.map((r) => [r.deploymentId, r]))
        deployments = deployments.map((d) => ({
          ...d,
          regressionReport: reportMap.get(d.id) || null,
        }))
      }
    } else {
      // Get all recent deployments across all agents
      const rows = await sql`
        SELECT
          d.id,
          d.prompt_version_id as "versionId",
          pv.agent_id as "agentId",
          d.deployed_by as "deployedBy",
          deployer.name as "deployedByName",
          d.deployed_at as "deployedAt",
          COALESCE(d.status, 'active') as status,
          d.regression_detected as "regressionDetected",
          pv.version
        FROM deployments d
        JOIN prompt_versions pv ON d.prompt_version_id = pv.id
        JOIN reviewers deployer ON d.deployed_by = deployer.id
        ORDER BY d.deployed_at DESC
        LIMIT ${limit}
      `
      deployments = rows as unknown as DeploymentRow[]
    }

    return NextResponse.json(deployments)
  } catch (error) {
    console.error('Failed to fetch deployments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch deployments' },
      { status: 500 }
    )
  }
}

// POST /api/admin/deployments - Create a new deployment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { versionId, deployedBy } = body

    if (!versionId || !deployedBy) {
      return NextResponse.json(
        { error: 'versionId and deployedBy are required' },
        { status: 400 }
      )
    }

    // Check if version exists and is approved
    const [version] = await sql`
      SELECT id, agent_id, status FROM prompt_versions WHERE id = ${versionId}
    `

    if (!version) {
      return NextResponse.json(
        { error: 'Prompt version not found' },
        { status: 404 }
      )
    }

    if (version.status !== 'approved') {
      return NextResponse.json(
        { error: 'Version must be approved before deployment' },
        { status: 400 }
      )
    }

    // Check deployer permissions
    const [deployer] = await sql`
      SELECT id, role FROM reviewers WHERE id = ${deployedBy}
    `

    if (!deployer || !['developer', 'admin'].includes(deployer.role)) {
      return NextResponse.json(
        { error: 'User does not have deployment permissions' },
        { status: 403 }
      )
    }

    // Get current deployment
    const [currentDeployment] = await sql`
      SELECT d.id
      FROM deployments d
      JOIN prompt_versions pv ON d.prompt_version_id = pv.id
      WHERE pv.agent_id = ${version.agent_id}
      AND d.rolled_back_at IS NULL
      AND (d.status = 'active' OR d.status IS NULL)
      ORDER BY d.deployed_at DESC
      LIMIT 1
    `

    // Capture baseline metrics (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const [metrics] = await sql`
      SELECT
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE outcome->>'success' = 'true') as success_count,
        COUNT(*) FILTER (WHERE status = 'failed') as error_count,
        AVG((metrics->>'totalSteps')::numeric) as avg_steps,
        AVG((metrics->>'durationMs')::numeric) as avg_duration_ms,
        AVG((metrics->>'efficiency')::numeric) as avg_efficiency
      FROM trajectories
      WHERE agent_id = ${version.agent_id}
      AND created_at >= ${oneHourAgo}
    `

    const totalCount = Number(metrics.total_count) || 0
    const metricsBaseline = {
      successRate: totalCount > 0 ? Number(metrics.success_count) / totalCount : 0,
      avgEfficiency: Number(metrics.avg_efficiency) || 0,
      errorRate: totalCount > 0 ? Number(metrics.error_count) / totalCount : 0,
      trajectoryCount: totalCount,
      avgSteps: Number(metrics.avg_steps) || 0,
      avgDurationMs: Number(metrics.avg_duration_ms) || 0,
      period: { start: oneHourAgo, end: new Date() },
    }

    // Create deployment
    const [deployment] = await sql`
      INSERT INTO deployments (
        prompt_version_id, deployed_by, metrics_before,
        previous_deployment_id, regression_detected, status
      ) VALUES (
        ${versionId}, ${deployedBy}, ${JSON.stringify(metricsBaseline)},
        ${currentDeployment?.id || null}, false, 'active'
      )
      RETURNING *
    `

    // Update prompt version to production
    await sql`
      UPDATE prompt_versions
      SET status = 'production', deployed_at = NOW()
      WHERE id = ${versionId}
    `

    // Update agent's current production version
    await sql`
      UPDATE agents
      SET current_production_version_id = ${versionId}
      WHERE id = ${version.agent_id}
    `

    // Mark previous deployment as superseded
    if (currentDeployment) {
      await sql`
        UPDATE deployments
        SET status = 'superseded'
        WHERE id = ${currentDeployment.id}
      `
    }

    return NextResponse.json(deployment, { status: 201 })
  } catch (error) {
    console.error('Failed to create deployment:', error)
    return NextResponse.json(
      { error: 'Failed to create deployment' },
      { status: 500 }
    )
  }
}
