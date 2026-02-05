import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

// GET /api/admin/approvals - List pending approvals
export async function GET(request: NextRequest) {
  try {
    const approvals = await sql`
      SELECT
        ar.id,
        ar.version_id as "versionId",
        ar.agent_id as "agentId",
        ar.requested_by as "requestedBy",
        r.name as "requestedByName",
        ar.requested_at as "requestedAt",
        ar.required_approvals as "requiredApprovals",
        ar.current_approvals as "currentApprovals",
        ar.status,
        ar.expires_at as "expiresAt",
        pv.version,
        pv.fitness,
        LEFT(pv.content->>'systemPrompt', 500) as "promptPreview"
      FROM approval_requests ar
      JOIN prompt_versions pv ON ar.version_id = pv.id
      JOIN reviewers r ON ar.requested_by = r.id
      WHERE ar.status = 'pending'
      AND (ar.expires_at IS NULL OR ar.expires_at > NOW())
      ORDER BY ar.requested_at DESC
    `

    return NextResponse.json(approvals)
  } catch (error) {
    console.error('Failed to fetch approvals:', error)
    return NextResponse.json(
      { error: 'Failed to fetch approvals' },
      { status: 500 }
    )
  }
}

// POST /api/admin/approvals - Request a new approval
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { versionId, requestedBy, requiredApprovals = 1, expiresInHours } = body

    if (!versionId || !requestedBy) {
      return NextResponse.json(
        { error: 'versionId and requestedBy are required' },
        { status: 400 }
      )
    }

    // Check if version exists
    const [version] = await sql`
      SELECT id, agent_id FROM prompt_versions WHERE id = ${versionId}
    `

    if (!version) {
      return NextResponse.json(
        { error: 'Prompt version not found' },
        { status: 404 }
      )
    }

    // Check for existing pending approval
    const [existing] = await sql`
      SELECT id FROM approval_requests
      WHERE version_id = ${versionId} AND status = 'pending'
    `

    if (existing) {
      return NextResponse.json(
        { error: 'Approval request already pending for this version' },
        { status: 400 }
      )
    }

    // Calculate expiration
    const expiresAt = expiresInHours
      ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
      : null

    // Create approval request
    const [approval] = await sql`
      INSERT INTO approval_requests (
        version_id, agent_id, requested_by, required_approvals, expires_at
      ) VALUES (
        ${versionId}, ${version.agent_id}, ${requestedBy},
        ${requiredApprovals}, ${expiresAt}
      )
      RETURNING *
    `

    return NextResponse.json(approval, { status: 201 })
  } catch (error) {
    console.error('Failed to create approval request:', error)
    return NextResponse.json(
      { error: 'Failed to create approval request' },
      { status: 500 }
    )
  }
}
