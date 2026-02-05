import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

interface RouteParams {
  params: Promise<{ versionId: string }>
}

// POST /api/admin/approvals/[versionId]/approve
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { versionId } = await params
    const body = await request.json()
    const { approverId, reason } = body

    if (!approverId) {
      return NextResponse.json(
        { error: 'approverId is required' },
        { status: 400 }
      )
    }

    // Check if approver has permission
    const [approver] = await sql`
      SELECT id, role FROM reviewers WHERE id = ${approverId}
    `

    if (!approver) {
      return NextResponse.json(
        { error: 'Approver not found' },
        { status: 404 }
      )
    }

    if (!['developer', 'admin'].includes(approver.role)) {
      return NextResponse.json(
        { error: 'User does not have approval permissions' },
        { status: 403 }
      )
    }

    // Get approval request
    const [approval] = await sql`
      SELECT * FROM approval_requests
      WHERE version_id = ${versionId}
    `

    if (!approval) {
      return NextResponse.json(
        { error: 'Approval request not found' },
        { status: 404 }
      )
    }

    if (approval.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot approve: request is ${approval.status}` },
        { status: 400 }
      )
    }

    // Check if expired
    if (approval.expires_at && new Date() > new Date(approval.expires_at)) {
      await sql`
        UPDATE approval_requests
        SET status = 'expired'
        WHERE id = ${approval.id}
      `
      return NextResponse.json(
        { error: 'Approval request has expired' },
        { status: 400 }
      )
    }

    // Check if already voted
    const [existingVote] = await sql`
      SELECT id FROM approval_votes
      WHERE approval_request_id = ${approval.id} AND approver_id = ${approverId}
    `

    if (existingVote) {
      return NextResponse.json(
        { error: 'You have already voted on this approval' },
        { status: 400 }
      )
    }

    // Create vote
    await sql`
      INSERT INTO approval_votes (
        approval_request_id, approver_id, vote, reason
      ) VALUES (
        ${approval.id}, ${approverId}, 'approve', ${reason || null}
      )
    `

    // Update approval count
    const newApprovalCount = approval.current_approvals + 1
    const isFullyApproved = newApprovalCount >= approval.required_approvals
    const newStatus = isFullyApproved ? 'approved' : 'pending'

    await sql`
      UPDATE approval_requests
      SET status = ${newStatus}, current_approvals = ${newApprovalCount}
      WHERE id = ${approval.id}
    `

    // Update prompt version status if approved
    if (isFullyApproved) {
      await sql`
        UPDATE prompt_versions
        SET status = 'approved'
        WHERE id = ${versionId}
      `
    }

    // Get updated status
    const [updatedApproval] = await sql`
      SELECT
        ar.id,
        ar.version_id as "versionId",
        ar.agent_id as "agentId",
        ar.status,
        ar.current_approvals as "currentApprovals",
        ar.required_approvals as "requiredApprovals"
      FROM approval_requests ar
      WHERE ar.id = ${approval.id}
    `

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
      request: updatedApproval,
      votes,
      canDeploy: updatedApproval.status === 'approved',
    })
  } catch (error) {
    console.error('Failed to approve:', error)
    return NextResponse.json(
      { error: 'Failed to approve' },
      { status: 500 }
    )
  }
}
