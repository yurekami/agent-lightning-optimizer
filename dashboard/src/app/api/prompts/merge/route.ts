import { NextRequest, NextResponse } from 'next/server'
import { canMerge, mergeBranch } from '@/lib/prompts'

/**
 * GET /api/prompts/merge?sourceBranchId=xxx&targetBranchId=xxx
 * Analyze if branches can be merged
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const sourceBranchId = searchParams.get('sourceBranchId')
    const targetBranchId = searchParams.get('targetBranchId')

    if (!sourceBranchId || !targetBranchId) {
      return NextResponse.json(
        { error: 'sourceBranchId and targetBranchId are required' },
        { status: 400 }
      )
    }

    const analysis = await canMerge(sourceBranchId, targetBranchId)

    return NextResponse.json({ analysis })
  } catch (error) {
    console.error('Failed to analyze merge:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/prompts/merge
 * Merge source branch into target branch
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sourceBranchId, targetBranchId, approvedBy } = body

    if (!sourceBranchId || !targetBranchId || !approvedBy) {
      return NextResponse.json(
        { error: 'sourceBranchId, targetBranchId, and approvedBy are required' },
        { status: 400 }
      )
    }

    const version = await mergeBranch(sourceBranchId, targetBranchId, approvedBy)

    return NextResponse.json({ version }, { status: 201 })
  } catch (error) {
    console.error('Failed to merge branches:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
