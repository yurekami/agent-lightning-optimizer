import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

interface RouteParams {
  params: Promise<{ versionId: string }>
}

// GET /api/admin/approvals/[versionId] - Get approval status
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { versionId } = await params

    const [approval] = await sql`
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
        ar.expires_at as "expiresAt"
      FROM approval_requests ar
      JOIN reviewers r ON ar.requested_by = r.id
      WHERE ar.version_id = ${versionId}
    `

    if (!approval) {
      return NextResponse.json(
        { error: 'Approval request not found' },
        { status: 404 }
      )
    }

    // Get votes
    const votes = await sql`
      SELECT
        av.id,
        av.approver_id as "approverId",
        r.name as "approverName",
        av.vote,
        av.reason,
        av.voted_at as "votedAt"
      FROM approval_votes av
      JOIN reviewers r ON av.approver_id = r.id
      WHERE av.approval_request_id = ${approval.id}
      ORDER BY av.voted_at ASC
    `

    return NextResponse.json({
      request: approval,
      votes,
      canDeploy: approval.status === 'approved',
    })
  } catch (error) {
    console.error('Failed to fetch approval status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch approval status' },
      { status: 500 }
    )
  }
}
