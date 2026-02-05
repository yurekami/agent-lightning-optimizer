import { NextRequest, NextResponse } from 'next/server'
import {
  createVersion,
  listVersions,
  getVersion,
  approveVersion,
  deployVersion,
  CreateVersionInput,
} from '@/lib/prompts'

/**
 * GET /api/prompts/versions?branchId=xxx&status=xxx
 * List versions for a branch
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const branchId = searchParams.get('branchId')
    const status = searchParams.get('status') || undefined

    if (!branchId) {
      return NextResponse.json(
        { error: 'branchId is required' },
        { status: 400 }
      )
    }

    const versions = await listVersions(branchId, status)

    return NextResponse.json({ versions })
  } catch (error) {
    console.error('Failed to list versions:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/prompts/versions
 * Create a new version
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateVersionInput = await request.json()

    if (!body.agentId || !body.branchId || !body.content) {
      return NextResponse.json(
        { error: 'agentId, branchId, and content are required' },
        { status: 400 }
      )
    }

    const version = await createVersion(body)

    return NextResponse.json({ version }, { status: 201 })
  } catch (error) {
    console.error('Failed to create version:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
