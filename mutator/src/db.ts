import postgres from 'postgres';
import { PromptVersion, PromptContent } from './types';

/**
 * Database operations for mutation service
 */
export class Database {
  private sql: postgres.Sql;

  constructor(connectionString: string) {
    this.sql = postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }

  /**
   * Get a prompt version by ID
   */
  async getPromptVersion(versionId: string): Promise<PromptVersion | null> {
    const rows = await this.sql<PromptVersion[]>`
      SELECT
        id,
        agent_id,
        branch_id,
        version,
        content,
        parent_ids,
        mutation_type,
        mutation_details,
        fitness,
        status,
        created_at,
        created_by,
        approved_by,
        deployed_at
      FROM prompt_versions
      WHERE id = ${versionId}
    `;

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get the latest version number for an agent on a branch
   */
  async getNextVersionNumber(agentId: string, branchId: string | null): Promise<number> {
    const rows = await this.sql<[{ next_version: number }]>`
      SELECT get_next_version(${agentId}, ${branchId}) as next_version
    `;

    return rows[0].next_version;
  }

  /**
   * Create a new prompt version (mutated variant)
   */
  async createPromptVersion(params: {
    agentId: string;
    branchId: string | null;
    content: PromptContent;
    parentIds: string[];
    mutationType: string;
    mutationDetails: any;
  }): Promise<PromptVersion> {
    const version = await this.getNextVersionNumber(params.agentId, params.branchId);

    const rows = await this.sql<PromptVersion[]>`
      INSERT INTO prompt_versions (
        agent_id,
        branch_id,
        version,
        content,
        parent_ids,
        mutation_type,
        mutation_details,
        status,
        created_by
      ) VALUES (
        ${params.agentId},
        ${params.branchId},
        ${version},
        ${this.sql.json(params.content)},
        ${this.sql.array(params.parentIds)},
        ${params.mutationType},
        ${this.sql.json(params.mutationDetails)},
        'candidate',
        'evolution'
      )
      RETURNING
        id,
        agent_id,
        branch_id,
        version,
        content,
        parent_ids,
        mutation_type,
        mutation_details,
        fitness,
        status,
        created_at,
        created_by,
        approved_by,
        deployed_at
    `;

    return rows[0];
  }

  /**
   * Get candidate versions that need more testing
   * (Low comparison count, ordered by creation date)
   */
  async getCandidatesForTesting(limit: number = 10): Promise<PromptVersion[]> {
    return await this.sql<PromptVersion[]>`
      SELECT
        id,
        agent_id,
        branch_id,
        version,
        content,
        parent_ids,
        mutation_type,
        mutation_details,
        fitness,
        status,
        created_at,
        created_by,
        approved_by,
        deployed_at
      FROM prompt_versions
      WHERE status = 'candidate'
        AND (fitness->>'comparisonCount')::int < 10
      ORDER BY created_at ASC
      LIMIT ${limit}
    `;
  }

  /**
   * Update fitness for a prompt version
   */
  async updateFitness(versionId: string): Promise<void> {
    await this.sql`
      UPDATE prompt_versions
      SET fitness = calculate_fitness(${versionId})
      WHERE id = ${versionId}
    `;
  }

  /**
   * Get all agents
   */
  async getAllAgents(): Promise<Array<{ id: string; name: string }>> {
    return await this.sql<Array<{ id: string; name: string }>>`
      SELECT id, name
      FROM agents
      ORDER BY name
    `;
  }

  /**
   * Get main branch for an agent
   */
  async getMainBranch(agentId: string): Promise<{ id: string } | null> {
    const rows = await this.sql<Array<{ id: string }>>`
      SELECT id
      FROM branches
      WHERE agent_id = ${agentId}
        AND is_main = true
      LIMIT 1
    `;

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Log mutation attempt
   */
  async logMutationAttempt(params: {
    versionId: string;
    mutationType: string;
    success: boolean;
    error?: string;
    resultVersionId?: string;
    duration: number;
  }): Promise<void> {
    // Create a mutations_log table if it doesn't exist
    await this.sql`
      CREATE TABLE IF NOT EXISTS mutations_log (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        version_id UUID NOT NULL,
        mutation_type VARCHAR(100) NOT NULL,
        success BOOLEAN NOT NULL,
        error TEXT,
        result_version_id UUID,
        duration_ms INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await this.sql`
      INSERT INTO mutations_log (
        version_id,
        mutation_type,
        success,
        error,
        result_version_id,
        duration_ms
      ) VALUES (
        ${params.versionId},
        ${params.mutationType},
        ${params.success},
        ${params.error || null},
        ${params.resultVersionId || null},
        ${params.duration}
      )
    `;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.sql.end();
  }
}
