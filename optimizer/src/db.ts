import postgres from 'postgres';
import { v4 as uuidv4 } from 'uuid';
import {
  PromptVersion,
  PromptVersionSchema,
  ComparisonFeedback,
  ComparisonFeedbackSchema,
  Trajectory,
  TrajectorySchema,
  EvolutionBranch,
  EvolutionBranchSchema,
  PromptContent,
} from './types';

// ============================================================================
// Database Connection
// ============================================================================

const connectionString = process.env.DATABASE_URL || 'postgres://localhost:5432/agent_lightning';

export const sql = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// ============================================================================
// Prompt Version Queries
// ============================================================================

export async function getPromptVersionsByBranch(branchId: string): Promise<PromptVersion[]> {
  const rows = await sql`
    SELECT
      id,
      branch_id,
      parent_version_id,
      generation,
      content,
      status,
      fitness_score,
      created_at,
      updated_at
    FROM prompt_versions
    WHERE branch_id = ${branchId}
    AND status IN ('candidate', 'active')
    ORDER BY fitness_score DESC NULLS LAST, generation DESC
  `;

  return rows.map((row) => PromptVersionSchema.parse({
    ...row,
    content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content,
  }));
}

export async function getPromptVersionById(id: string): Promise<PromptVersion | null> {
  const rows = await sql`
    SELECT
      id,
      branch_id,
      parent_version_id,
      generation,
      content,
      status,
      fitness_score,
      created_at,
      updated_at
    FROM prompt_versions
    WHERE id = ${id}
  `;

  if (rows.length === 0) return null;

  return PromptVersionSchema.parse({
    ...rows[0],
    content: typeof rows[0].content === 'string' ? JSON.parse(rows[0].content) : rows[0].content,
  });
}

export async function createPromptVersion(
  branchId: string,
  content: PromptContent,
  parentVersionId: string | null,
  generation: number
): Promise<PromptVersion> {
  const id = uuidv4();
  const now = new Date();

  const rows = await sql`
    INSERT INTO prompt_versions (
      id, branch_id, parent_version_id, generation, content, status, fitness_score, created_at, updated_at
    ) VALUES (
      ${id}, ${branchId}, ${parentVersionId}, ${generation}, ${JSON.stringify(content)}, 'candidate', NULL, ${now}, ${now}
    )
    RETURNING *
  `;

  return PromptVersionSchema.parse({
    ...rows[0],
    content: typeof rows[0].content === 'string' ? JSON.parse(rows[0].content) : rows[0].content,
  });
}

export async function updatePromptVersionFitness(id: string, fitnessScore: number): Promise<void> {
  await sql`
    UPDATE prompt_versions
    SET fitness_score = ${fitnessScore}, updated_at = ${new Date()}
    WHERE id = ${id}
  `;
}

export async function updatePromptVersionStatus(
  id: string,
  status: 'candidate' | 'active' | 'archived' | 'rejected'
): Promise<void> {
  await sql`
    UPDATE prompt_versions
    SET status = ${status}, updated_at = ${new Date()}
    WHERE id = ${id}
  `;
}

export async function getMaxGeneration(branchId: string): Promise<number> {
  const rows = await sql`
    SELECT COALESCE(MAX(generation), 0) as max_gen
    FROM prompt_versions
    WHERE branch_id = ${branchId}
  `;

  return rows[0].max_gen as number;
}

// ============================================================================
// Comparison Feedback Queries
// ============================================================================

export async function getComparisonsByVersion(versionId: string): Promise<ComparisonFeedback[]> {
  const rows = await sql`
    SELECT
      id,
      trajectory_a_id,
      trajectory_b_id,
      version_a_id,
      version_b_id,
      winner,
      confidence,
      feedback_source,
      reasoning,
      created_at
    FROM comparison_feedback
    WHERE version_a_id = ${versionId} OR version_b_id = ${versionId}
  `;

  return rows.map((row) => ComparisonFeedbackSchema.parse(row));
}

export async function getRecentComparisons(branchId: string, limit: number = 100): Promise<ComparisonFeedback[]> {
  const rows = await sql`
    SELECT cf.*
    FROM comparison_feedback cf
    JOIN prompt_versions pv_a ON cf.version_a_id = pv_a.id
    JOIN prompt_versions pv_b ON cf.version_b_id = pv_b.id
    WHERE pv_a.branch_id = ${branchId} OR pv_b.branch_id = ${branchId}
    ORDER BY cf.created_at DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ComparisonFeedbackSchema.parse(row));
}

// ============================================================================
// Trajectory Queries
// ============================================================================

export async function getTrajectoriesByVersion(versionId: string): Promise<Trajectory[]> {
  const rows = await sql`
    SELECT
      id,
      agent_id,
      prompt_version_id,
      session_id,
      success,
      efficiency_rating,
      created_at,
      completed_at
    FROM trajectories
    WHERE prompt_version_id = ${versionId}
  `;

  return rows.map((row) => TrajectorySchema.parse(row));
}

// ============================================================================
// Evolution Branch Queries
// ============================================================================

export async function getActiveBranches(): Promise<EvolutionBranch[]> {
  const rows = await sql`
    SELECT
      id,
      agent_id,
      name,
      description,
      parent_branch_id,
      status,
      created_at,
      updated_at
    FROM evolution_branches
    WHERE status = 'active'
  `;

  return rows.map((row) => EvolutionBranchSchema.parse(row));
}

export async function getBranchById(id: string): Promise<EvolutionBranch | null> {
  const rows = await sql`
    SELECT
      id,
      agent_id,
      name,
      description,
      parent_branch_id,
      status,
      created_at,
      updated_at
    FROM evolution_branches
    WHERE id = ${id}
  `;

  if (rows.length === 0) return null;

  return EvolutionBranchSchema.parse(rows[0]);
}

// ============================================================================
// Generation History Queries (for plateau detection)
// ============================================================================

export async function getGenerationHistory(branchId: string, limit: number = 10): Promise<{
  generation: number;
  maxFitness: number;
  avgFitness: number;
}[]> {
  const rows = await sql`
    SELECT
      generation,
      MAX(fitness_score) as max_fitness,
      AVG(fitness_score) as avg_fitness
    FROM prompt_versions
    WHERE branch_id = ${branchId}
    AND fitness_score IS NOT NULL
    GROUP BY generation
    ORDER BY generation DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    generation: row.generation as number,
    maxFitness: row.max_fitness as number,
    avgFitness: row.avg_fitness as number,
  }));
}

// ============================================================================
// Cleanup
// ============================================================================

export async function closeConnection(): Promise<void> {
  await sql.end();
}
