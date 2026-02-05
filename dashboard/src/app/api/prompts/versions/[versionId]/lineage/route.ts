import { NextRequest, NextResponse } from 'next/server'
import { getLineage, getAncestors, getDescendants } from '@/lib/prompts'

/**
 * GET /api/prompts/versions/[versionId]/lineage?type=full|ancestors|descendants&depth=N
 * Get lineage information for a version
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { versionId: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') || 'full'
    const depth = searchParams.get('depth')

    let lineage

    if (type === 'ancestors') {
      lineage = await getAncestors(
        params.versionId,
        depth ? parseInt(depth) : undefined
      )
    } else if (type === 'descendants') {
      lineage = await getDescendants(params.versionId)
    } else {
      lineage = await getLineage(params.versionId)
    }

    return NextResponse.json({ lineage })
  } catch (error) {
    console.error('Failed to get lineage:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
