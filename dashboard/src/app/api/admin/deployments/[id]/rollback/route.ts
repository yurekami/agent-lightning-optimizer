import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/admin/deployments/[id]/rollback
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()
    const { rolledBackBy, reason } = body

    if (!rolledBackBy) {
      return NextResponse.json(
        { error: 'rolledBackBy is required' },
        { status: 400 }
      )
    }

    // Check permissions
    const [user] = await sql`
      SELECT id, role FROM reviewers WHERE id = ${rolledBackBy}
    `

    if (!user || !['developer', 'admin'].includes(user.role)) {
      return NextResponse.json(
        { error: 'User does not have rollback permissions' },
        { status: 403 }
      )
    }

    // Get the deployment to rollback
    const [deployment] = await sql`
      SELECT d.*, pv.agent_id
      FROM deployments d
      JOIN prompt_versions pv ON d.prompt_version_id = pv.id
      WHERE d.id = ${id}
    `

    if (!deployment) {
      return NextResponse.json(
        { error: 'Deployment not found' },
        { status: 404 }
      )
    }

    if (deployment.rolled_back_at) {
      return NextResponse.json(
        { error: 'Deployment has already been rolled back' },
        { status: 400 }
      )
    }

    // Get the previous deployment
    if (!deployment.previous_deployment_id) {
      return NextResponse.json(
        { error: 'No previous deployment to rollback to' },
        { status: 400 }
      )
    }

    const [previousDeployment] = await sql`
      SELECT d.*, pv.agent_id
      FROM deployments d
      JOIN prompt_versions pv ON d.prompt_version_id = pv.id
      WHERE d.id = ${deployment.previous_deployment_id}
    `

    if (!previousDeployment) {
      return NextResponse.json(
        { error: 'Previous deployment not found' },
        { status: 404 }
      )
    }

    // Perform rollback operations
    // Mark current deployment as rolled back
    await sql`
      UPDATE deployments
      SET rolled_back_at = NOW(),
          rolled_back_by = ${rolledBackBy},
          rollback_reason = ${reason || null},
          status = 'rolled_back'
      WHERE id = ${id}
    `

    // Update agent to use previous version
    await sql`
      UPDATE agents
      SET current_production_version_id = ${previousDeployment.prompt_version_id}
      WHERE id = ${deployment.agent_id}
    `

    // Update previous deployment status to active
    await sql`
      UPDATE deployments
      SET status = 'active'
      WHERE id = ${previousDeployment.id}
    `

    // Update prompt version statuses
    await sql`
      UPDATE prompt_versions
      SET status = 'candidate'
      WHERE id = ${deployment.prompt_version_id}
    `

    await sql`
      UPDATE prompt_versions
      SET status = 'production'
      WHERE id = ${previousDeployment.prompt_version_id}
    `

    // Fetch and return the restored deployment
    const [restoredDeployment] = await sql`
      SELECT
        d.id,
        d.prompt_version_id as "versionId",
        pv.agent_id as "agentId",
        d.deployed_by as "deployedBy",
        deployer.name as "deployedByName",
        d.deployed_at as "deployedAt",
        COALESCE(d.status, 'active') as status,
        pv.version
      FROM deployments d
      JOIN prompt_versions pv ON d.prompt_version_id = pv.id
      JOIN reviewers deployer ON d.deployed_by = deployer.id
      WHERE d.id = ${previousDeployment.id}
    `

    return NextResponse.json(restoredDeployment)
  } catch (error) {
    console.error('Failed to rollback:', error)
    return NextResponse.json(
      { error: 'Failed to rollback deployment' },
      { status: 500 }
    )
  }
}
