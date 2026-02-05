import { NextRequest, NextResponse } from 'next/server'
import { deployVersion } from '@/lib/prompts'

/**
 * POST /api/prompts/versions/[versionId]/deploy
 * Deploy a version to production
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { versionId: string } }
) {
  try {
    const body = await request.json()
    const { reviewerId } = body

    if (!reviewerId) {
      return NextResponse.json(
        { error: 'reviewerId is required' },
        { status: 400 }
      )
    }

    const version = await deployVersion(params.versionId, reviewerId)

    return NextResponse.json({ version })
  } catch (error) {
    console.error('Failed to deploy version:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
