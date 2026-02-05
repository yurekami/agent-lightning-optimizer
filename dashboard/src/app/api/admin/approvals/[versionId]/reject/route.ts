import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

interface RouteParams {
  params: Promise<{ versionId: string }>
}

// POST /api/admin/approvals/[versionId]/reject
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

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { error: 'reason is required for rejection' },
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
        { error: `Cannot reject: request is ${approval.status}` },
        { status: 400 }
      )
    }

    // Create rejection vote
    await sql`
      INSERT INTO approval_votes (
        approval_request_id, approver_id, vote, reason
      ) VALUES (
        ${approval.id}, ${approverId}, 'reject', ${reason}
      )
    `

    // Update request status to rejected
    await sql`
      UPDATE approval_requests
      SET status = 'rejected'
      WHERE id = ${approval.id}
    `

    // Update prompt version status back to candidate
    await sql`
      UPDATE prompt_versions
      SET status = 'candidate'
      WHERE id = ${versionId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to reject:', error)
    return NextResponse.json(
      { error: 'Failed to reject' },
      { status: 500 }
    )
  }
}
