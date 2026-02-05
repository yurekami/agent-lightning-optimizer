import { NextRequest, NextResponse } from 'next/server'
import { approveVersion } from '@/lib/prompts'

/**
 * POST /api/prompts/versions/[versionId]/approve
 * Approve a version
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { versionId: string } }
) {
  try {
    const body = await request.json()
    const { reviewerEmail } = body

    if (!reviewerEmail) {
      return NextResponse.json(
        { error: 'reviewerEmail is required' },
        { status: 400 }
      )
    }

    const version = await approveVersion(params.versionId, reviewerEmail)

    return NextResponse.json({ version })
  } catch (error) {
    console.error('Failed to approve version:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
