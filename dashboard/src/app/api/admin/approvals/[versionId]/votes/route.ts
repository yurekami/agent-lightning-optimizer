import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

interface RouteParams {
  params: Promise<{ versionId: string }>
}

// GET /api/admin/approvals/[versionId]/votes - Get votes for an approval
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { versionId } = await params

    // Get approval request
    const [approval] = await sql`
      SELECT id FROM approval_requests
      WHERE version_id = ${versionId}
    `

    if (!approval) {
      return NextResponse.json([])
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

    return NextResponse.json(votes)
  } catch (error) {
    console.error('Failed to fetch votes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch votes' },
      { status: 500 }
    )
  }
}
