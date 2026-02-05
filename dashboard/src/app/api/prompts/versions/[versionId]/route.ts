import { NextRequest, NextResponse } from 'next/server'
import { getVersion } from '@/lib/prompts'

/**
 * GET /api/prompts/versions/[versionId]
 * Get a specific version by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { versionId: string } }
) {
  try {
    const version = await getVersion(params.versionId)

    return NextResponse.json({ version })
  } catch (error) {
    console.error('Failed to get version:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
