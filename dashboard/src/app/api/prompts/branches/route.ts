import { NextRequest, NextResponse } from 'next/server'
import { createBranch, listBranches, deleteBranch } from '@/lib/prompts'

/**
 * GET /api/prompts/branches?agentId=xxx
 * List all branches for an agent
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const agentId = searchParams.get('agentId')

    if (!agentId) {
      return NextResponse.json(
        { error: 'agentId is required' },
        { status: 400 }
      )
    }

    const branches = await listBranches(agentId)

    return NextResponse.json({ branches })
  } catch (error) {
    console.error('Failed to list branches:', error)
    return NextResponse.json(
      { error: 'Failed to list branches' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/prompts/branches
 * Create a new branch
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agentId, name, parentBranchId } = body

    if (!agentId || !name) {
      return NextResponse.json(
        { error: 'agentId and name are required' },
        { status: 400 }
      )
    }

    const branch = await createBranch(agentId, name, parentBranchId)

    return NextResponse.json({ branch }, { status: 201 })
  } catch (error) {
    console.error('Failed to create branch:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/prompts/branches?branchId=xxx
 * Delete a branch
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const branchId = searchParams.get('branchId')

    if (!branchId) {
      return NextResponse.json(
        { error: 'branchId is required' },
        { status: 400 }
      )
    }

    await deleteBranch(branchId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete branch:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
