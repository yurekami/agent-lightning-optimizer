import { sql } from './db'

// =============================================================================
// TYPES
// =============================================================================

export interface Branch {
  id: string
  agentId: string
  name: string
  parentBranchId: string | null
  createdAt: Date
  isMain: boolean
}

export interface PromptVersion {
  id: string
  agentId: string
  branchId: string | null
  version: number
  content: PromptContent
  parentIds: string[]
  mutationType: string | null
  mutationDetails: any
  fitness: FitnessMetrics
  status: 'candidate' | 'approved' | 'production' | 'retired'
  createdAt: Date
  createdBy: 'evolution' | 'manual'
  approvedBy: string[]
  deployedAt: Date | null
}

export interface PromptContent {
  systemPrompt: string
  toolDescriptions: Record<string, string>
  subagentPrompts?: Record<string, string>
}

export interface FitnessMetrics {
  winRate: number | null
  successRate: number | null
  avgEfficiency: number | null
  comparisonCount: number
}

export interface LineageNode {
  id: string
  version: number
  depth: number
  parentIds: string[]
  branchName: string
  status: string
  fitness: FitnessMetrics
  createdAt: Date
}

export interface CreateVersionInput {
  agentId: string
  branchId: string
  content: PromptContent
  parentIds?: string[]
  mutationType?: string
  mutationDetails?: any
  createdBy?: 'evolution' | 'manual'
}

export interface MergeAnalysis {
  canMerge: boolean
  conflicts: string[]
  targetLatestVersion: PromptVersion | null
  sourceLatestVersion: PromptVersion | null
  commonAncestor: PromptVersion | null
}

// =============================================================================
// BRANCH OPERATIONS
// =============================================================================

/**
 * Create a new branch
 */
export async function createBranch(
  agentId: string,
  name: string,
  parentBranchId?: string
): Promise<Branch> {
  const [branch] = await sql<Branch[]>`
    INSERT INTO branches (agent_id, name, parent_branch_id, is_main)
    VALUES (${agentId}, ${name}, ${parentBranchId || null}, false)
    RETURNING *
  `
  return branch
}

/**
 * List all branches for an agent
 */
export async function listBranches(agentId: string): Promise<Branch[]> {
  const branches = await sql<Branch[]>`
    SELECT * FROM branches
    WHERE agent_id = ${agentId}
    ORDER BY is_main DESC, created_at DESC
  `
  return branches
}

/**
 * Delete a branch (soft delete - prevent if has versions)
 */
export async function deleteBranch(branchId: string): Promise<void> {
  // Check if branch has versions
  const [versionCount] = await sql<[{ count: number }]>`
    SELECT COUNT(*) as count FROM prompt_versions
    WHERE branch_id = ${branchId}
  `

  if (versionCount.count > 0) {
    throw new Error('Cannot delete branch with existing versions')
  }

  await sql`
    DELETE FROM branches WHERE id = ${branchId}
  `
}

/**
 * Get the main branch for an agent
 */
export async function getMainBranch(agentId: string): Promise<Branch> {
  const [branch] = await sql<Branch[]>`
    SELECT * FROM branches
    WHERE agent_id = ${agentId} AND is_main = true
  `

  if (!branch) {
    // Create main branch if it doesn't exist
    const [newBranch] = await sql<Branch[]>`
      INSERT INTO branches (agent_id, name, is_main)
      VALUES (${agentId}, 'main', true)
      RETURNING *
    `
    return newBranch
  }

  return branch
}

// =============================================================================
// VERSION OPERATIONS
// =============================================================================

/**
 * Create a new version
 */
export async function createVersion(data: CreateVersionInput): Promise<PromptVersion> {
  const {
    agentId,
    branchId,
    content,
    parentIds = [],
    mutationType = null,
    mutationDetails = null,
    createdBy = 'manual',
  } = data

  // Get next version number for this branch
  const [{ nextVersion }] = await sql<[{ nextVersion: number }]>`
    SELECT get_next_version(${agentId}, ${branchId}) as "nextVersion"
  `

  const [version] = await sql<PromptVersion[]>`
    INSERT INTO prompt_versions (
      agent_id,
      branch_id,
      version,
      content,
      parent_ids,
      mutation_type,
      mutation_details,
      created_by
    )
    VALUES (
      ${agentId},
      ${branchId},
      ${nextVersion},
      ${sql.json(content)},
      ${sql.array(parentIds)},
      ${mutationType},
      ${sql.json(mutationDetails)},
      ${createdBy}
    )
    RETURNING *
  `

  return version
}

/**
 * Get a specific version by ID
 */
export async function getVersion(versionId: string): Promise<PromptVersion> {
  const [version] = await sql<PromptVersion[]>`
    SELECT * FROM prompt_versions WHERE id = ${versionId}
  `

  if (!version) {
    throw new Error(`Version ${versionId} not found`)
  }

  return version
}

/**
 * List versions for a branch
 */
export async function listVersions(
  branchId: string,
  status?: string
): Promise<PromptVersion[]> {
  if (status) {
    return await sql<PromptVersion[]>`
      SELECT * FROM prompt_versions
      WHERE branch_id = ${branchId} AND status = ${status}
      ORDER BY version DESC
    `
  }

  return await sql<PromptVersion[]>`
    SELECT * FROM prompt_versions
    WHERE branch_id = ${branchId}
    ORDER BY version DESC
  `
}

/**
 * Get the latest version on a branch
 */
export async function getLatestVersion(branchId: string): Promise<PromptVersion> {
  const [version] = await sql<PromptVersion[]>`
    SELECT * FROM prompt_versions
    WHERE branch_id = ${branchId}
    ORDER BY version DESC
    LIMIT 1
  `

  if (!version) {
    throw new Error(`No versions found for branch ${branchId}`)
  }

  return version
}

/**
 * Get the current production version for an agent
 */
export async function getProductionVersion(agentId: string): Promise<PromptVersion | null> {
  const [version] = await sql<PromptVersion[]>`
    SELECT pv.* FROM prompt_versions pv
    JOIN agents a ON a.current_production_version_id = pv.id
    WHERE a.id = ${agentId}
  `

  return version || null
}

/**
 * Approve a version (add reviewer to approved_by list)
 */
export async function approveVersion(
  versionId: string,
  reviewerEmail: string
): Promise<PromptVersion> {
  const [version] = await sql<PromptVersion[]>`
    UPDATE prompt_versions
    SET
      approved_by = array_append(approved_by, ${reviewerEmail}),
      status = CASE
        WHEN status = 'candidate' THEN 'approved'::prompt_version_status
        ELSE status
      END
    WHERE id = ${versionId}
    RETURNING *
  `

  return version
}

/**
 * Deploy a version to production
 */
export async function deployVersion(
  versionId: string,
  reviewerId: string
): Promise<PromptVersion> {
  // Start transaction
  await sql.begin(async (sql) => {
    // Get the version
    const [version] = await sql<PromptVersion[]>`
      SELECT * FROM prompt_versions WHERE id = ${versionId}
    `

    if (!version) {
      throw new Error('Version not found')
    }

    // Retire current production version
    await sql`
      UPDATE prompt_versions
      SET status = 'retired'::prompt_version_status
      WHERE agent_id = ${version.agentId} AND status = 'production'::prompt_version_status
    `

    // Update version to production
    await sql`
      UPDATE prompt_versions
      SET
        status = 'production'::prompt_version_status,
        deployed_at = NOW()
      WHERE id = ${versionId}
    `

    // Update agent's current production version
    await sql`
      UPDATE agents
      SET current_production_version_id = ${versionId}
      WHERE id = ${version.agentId}
    `

    // Record deployment
    await sql`
      INSERT INTO deployments (prompt_version_id, deployed_by)
      VALUES (${versionId}, ${reviewerId})
    `
  })

  return await getVersion(versionId)
}

// =============================================================================
// LINEAGE OPERATIONS
// =============================================================================

/**
 * Get the full lineage tree for a version
 */
export async function getLineage(versionId: string): Promise<LineageNode[]> {
  const lineage = await sql<LineageNode[]>`
    WITH RECURSIVE lineage_tree AS (
      -- Base case: start with the target version
      SELECT
        pv.id,
        pv.version,
        pv.parent_ids,
        pv.status,
        pv.fitness,
        pv.created_at,
        b.name as branch_name,
        0 as depth
      FROM prompt_versions pv
      LEFT JOIN branches b ON b.id = pv.branch_id
      WHERE pv.id = ${versionId}

      UNION ALL

      -- Recursive case: get ancestors
      SELECT
        pv.id,
        pv.version,
        pv.parent_ids,
        pv.status,
        pv.fitness,
        pv.created_at,
        b.name as branch_name,
        lt.depth + 1 as depth
      FROM prompt_versions pv
      LEFT JOIN branches b ON b.id = pv.branch_id
      JOIN lineage_tree lt ON pv.id = ANY(lt.parent_ids)
    )
    SELECT
      id,
      version,
      depth,
      parent_ids as "parentIds",
      branch_name as "branchName",
      status,
      fitness,
      created_at as "createdAt"
    FROM lineage_tree
    ORDER BY depth, created_at
  `

  return lineage
}

/**
 * Get ancestors of a version (parents, grandparents, etc.)
 */
export async function getAncestors(
  versionId: string,
  depth?: number
): Promise<PromptVersion[]> {
  const depthClause = depth ? sql`AND lt.depth <= ${depth}` : sql``

  const ancestors = await sql<PromptVersion[]>`
    WITH RECURSIVE lineage_tree AS (
      SELECT
        pv.*,
        0 as depth
      FROM prompt_versions pv
      WHERE pv.id = ${versionId}

      UNION ALL

      SELECT
        pv.*,
        lt.depth + 1 as depth
      FROM prompt_versions pv
      JOIN lineage_tree lt ON pv.id = ANY(lt.parent_ids)
      WHERE true ${depthClause}
    )
    SELECT * FROM lineage_tree
    WHERE depth > 0
    ORDER BY depth
  `

  return ancestors
}

/**
 * Get descendants of a version (children, grandchildren, etc.)
 */
export async function getDescendants(versionId: string): Promise<PromptVersion[]> {
  const descendants = await sql<PromptVersion[]>`
    WITH RECURSIVE lineage_tree AS (
      SELECT
        pv.*,
        0 as depth
      FROM prompt_versions pv
      WHERE pv.id = ${versionId}

      UNION ALL

      SELECT
        pv.*,
        lt.depth + 1 as depth
      FROM prompt_versions pv
      JOIN lineage_tree lt ON ${versionId} = ANY(pv.parent_ids)
    )
    SELECT * FROM lineage_tree
    WHERE depth > 0
    ORDER BY depth, created_at
  `

  return descendants
}

/**
 * Find common ancestor between two versions
 */
export async function findCommonAncestor(
  versionIdA: string,
  versionIdB: string
): Promise<PromptVersion | null> {
  const [ancestor] = await sql<PromptVersion[]>`
    WITH RECURSIVE
      ancestors_a AS (
        SELECT id, parent_ids, 0 as depth
        FROM prompt_versions
        WHERE id = ${versionIdA}

        UNION ALL

        SELECT pv.id, pv.parent_ids, aa.depth + 1
        FROM prompt_versions pv
        JOIN ancestors_a aa ON pv.id = ANY(aa.parent_ids)
      ),
      ancestors_b AS (
        SELECT id, parent_ids, 0 as depth
        FROM prompt_versions
        WHERE id = ${versionIdB}

        UNION ALL

        SELECT pv.id, pv.parent_ids, ab.depth + 1
        FROM prompt_versions pv
        JOIN ancestors_b ab ON pv.id = ANY(ab.parent_ids)
      )
    SELECT pv.*
    FROM prompt_versions pv
    WHERE pv.id IN (SELECT id FROM ancestors_a)
      AND pv.id IN (SELECT id FROM ancestors_b)
    ORDER BY pv.created_at DESC
    LIMIT 1
  `

  return ancestor || null
}

// =============================================================================
// MERGE OPERATIONS
// =============================================================================

/**
 * Analyze if two branches can be merged
 */
export async function canMerge(
  sourceBranchId: string,
  targetBranchId: string
): Promise<MergeAnalysis> {
  try {
    const sourceLatest = await getLatestVersion(sourceBranchId)
    const targetLatest = await getLatestVersion(targetBranchId)

    // Find common ancestor
    const commonAncestor = await findCommonAncestor(sourceLatest.id, targetLatest.id)

    // Check for conflicts (simplified - just check if both branches have changes)
    const conflicts: string[] = []

    if (!commonAncestor) {
      conflicts.push('No common ancestor found - branches have diverged completely')
    } else if (sourceLatest.id === targetLatest.id) {
      conflicts.push('Branches are already at the same version')
    }

    return {
      canMerge: conflicts.length === 0,
      conflicts,
      targetLatestVersion: targetLatest,
      sourceLatestVersion: sourceLatest,
      commonAncestor,
    }
  } catch (error) {
    return {
      canMerge: false,
      conflicts: [(error as Error).message],
      targetLatestVersion: null,
      sourceLatestVersion: null,
      commonAncestor: null,
    }
  }
}

/**
 * Merge source branch into target branch
 */
export async function mergeBranch(
  sourceBranchId: string,
  targetBranchId: string,
  approvedBy: string
): Promise<PromptVersion> {
  // Analyze merge
  const analysis = await canMerge(sourceBranchId, targetBranchId)

  if (!analysis.canMerge) {
    throw new Error(`Cannot merge: ${analysis.conflicts.join(', ')}`)
  }

  if (!analysis.sourceLatestVersion) {
    throw new Error('Source branch has no versions')
  }

  // Get target branch info
  const [targetBranch] = await sql<Branch[]>`
    SELECT * FROM branches WHERE id = ${targetBranchId}
  `

  // Create merge version on target branch
  const mergeVersion = await createVersion({
    agentId: targetBranch.agentId,
    branchId: targetBranchId,
    content: analysis.sourceLatestVersion.content,
    parentIds: [
      analysis.targetLatestVersion?.id,
      analysis.sourceLatestVersion.id,
    ].filter(Boolean) as string[],
    mutationType: 'merge',
    mutationDetails: {
      sourceBranch: sourceBranchId,
      targetBranch: targetBranchId,
      mergedAt: new Date().toISOString(),
    },
    createdBy: 'manual',
  })

  // Auto-approve the merge
  await approveVersion(mergeVersion.id, approvedBy)

  return mergeVersion
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Update fitness metrics for a version
 */
export async function updateFitness(versionId: string): Promise<void> {
  await sql`
    UPDATE prompt_versions
    SET fitness = calculate_fitness(${versionId})
    WHERE id = ${versionId}
  `
}

/**
 * Get version statistics for a branch
 */
export async function getBranchStats(branchId: string) {
  const [stats] = await sql<[{
    totalVersions: number
    candidateCount: number
    approvedCount: number
    productionCount: number
    avgFitness: number | null
  }]>`
    SELECT
      COUNT(*) as "totalVersions",
      COUNT(*) FILTER (WHERE status = 'candidate') as "candidateCount",
      COUNT(*) FILTER (WHERE status = 'approved') as "approvedCount",
      COUNT(*) FILTER (WHERE status = 'production') as "productionCount",
      AVG((fitness->>'winRate')::numeric) as "avgFitness"
    FROM prompt_versions
    WHERE branch_id = ${branchId}
  `

  return stats
}
