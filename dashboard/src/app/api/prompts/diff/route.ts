import { NextRequest, NextResponse } from 'next/server'
import { getVersion, getProductionVersion } from '@/lib/prompts'
import { diffPromptContent } from '@/lib/diff'

/**
 * GET /api/prompts/diff?versionIdA=xxx&versionIdB=xxx
 * OR /api/prompts/diff?versionId=xxx&toProduction=true
 * Get diff between two versions
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const versionIdA = searchParams.get('versionIdA')
    const versionIdB = searchParams.get('versionIdB')
    const versionId = searchParams.get('versionId')
    const toProduction = searchParams.get('toProduction') === 'true'

    let versionA, versionB

    if (toProduction && versionId) {
      // Diff against production
      versionB = await getVersion(versionId)
      const production = await getProductionVersion(versionB.agentId)

      if (!production) {
        return NextResponse.json(
          { error: 'No production version found' },
          { status: 404 }
        )
      }

      versionA = production
    } else if (versionIdA && versionIdB) {
      // Diff between two specific versions
      versionA = await getVersion(versionIdA)
      versionB = await getVersion(versionIdB)
    } else {
      return NextResponse.json(
        { error: 'Either (versionIdA and versionIdB) or (versionId and toProduction) are required' },
        { status: 400 }
      )
    }

    const diff = diffPromptContent(versionA.content, versionB.content)

    return NextResponse.json({
      diff,
      versionA: {
        id: versionA.id,
        version: versionA.version,
        status: versionA.status,
      },
      versionB: {
        id: versionB.id,
        version: versionB.version,
        status: versionB.status,
      },
    })
  } catch (error) {
    console.error('Failed to compute diff:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
