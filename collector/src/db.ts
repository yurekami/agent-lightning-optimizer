import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL ||
  `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

const sql = postgres(connectionString, {
  max: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
  idle_timeout: 20,
  connect_timeout: 10,
  onnotice: () => {}, // Suppress notices in production
});

export interface DBTrajectory {
  id: string;
  agent_id: string;
  task_type: string;
  initial_prompt: string;
  outcome: 'success' | 'failure' | 'partial' | null;
  status: 'in_progress' | 'completed';
  final_result: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  total_duration_ms: number | null;
  created_at: Date;
  completed_at: Date | null;
}

export interface DBTrajectoryStep {
  id: string;
  trajectory_id: string;
  step_number: number;
  timestamp: Date;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_output: Record<string, unknown> | null;
  thinking_content: string | null;
  error: string | null;
  duration_ms: number | null;
}

export interface TrajectoryWithSteps extends DBTrajectory {
  steps: DBTrajectoryStep[];
}

export const db = {
  async insertTrajectory(data: {
    id: string;
    agent_id: string;
    task_type: string;
    initial_prompt: string;
    outcome?: 'success' | 'failure' | 'partial' | null;
    status: 'in_progress' | 'completed';
    final_result?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
    total_duration_ms?: number | null;
    created_at?: Date;
  }): Promise<DBTrajectory> {
    const [trajectory] = await sql<DBTrajectory[]>`
      INSERT INTO trajectories (
        id, agent_id, task_type, initial_prompt, outcome, status,
        final_result, metadata, total_duration_ms, created_at
      ) VALUES (
        ${data.id},
        ${data.agent_id},
        ${data.task_type},
        ${data.initial_prompt},
        ${data.outcome ?? null},
        ${data.status},
        ${data.final_result ? sql.json(data.final_result) : null},
        ${data.metadata ? sql.json(data.metadata) : null},
        ${data.total_duration_ms ?? null},
        ${data.created_at ?? new Date()}
      )
      RETURNING *
    `;
    return trajectory;
  },

  async insertTrajectorySteps(
    trajectoryId: string,
    steps: Array<{
      id: string;
      step_number: number;
      timestamp: Date;
      tool_name: string;
      tool_input: Record<string, unknown>;
      tool_output: Record<string, unknown> | null;
      thinking_content: string | null;
      error: string | null;
      duration_ms: number | null;
    }>
  ): Promise<DBTrajectoryStep[]> {
    if (steps.length === 0) return [];

    return sql<DBTrajectoryStep[]>`
      INSERT INTO trajectory_steps ${sql(
        steps.map((step) => ({
          id: step.id,
          trajectory_id: trajectoryId,
          step_number: step.step_number,
          timestamp: step.timestamp,
          tool_name: step.tool_name,
          tool_input: sql.json(step.tool_input),
          tool_output: step.tool_output ? sql.json(step.tool_output) : null,
          thinking_content: step.thinking_content,
          error: step.error,
          duration_ms: step.duration_ms,
        }))
      )}
      RETURNING *
    `;
  },

  async getTrajectoryById(id: string): Promise<TrajectoryWithSteps | null> {
    const [trajectory] = await sql<DBTrajectory[]>`
      SELECT * FROM trajectories WHERE id = ${id}
    `;

    if (!trajectory) return null;

    const steps = await sql<DBTrajectoryStep[]>`
      SELECT * FROM trajectory_steps
      WHERE trajectory_id = ${id}
      ORDER BY step_number ASC
    `;

    return {
      ...trajectory,
      steps,
    };
  },

  async listTrajectories(filters: {
    agent_id?: string;
    task_type?: string;
    status?: 'in_progress' | 'completed';
    outcome?: 'success' | 'failure' | 'partial';
    limit: number;
    offset: number;
  }): Promise<DBTrajectory[]> {
    const conditions = [];
    const params: Record<string, unknown> = {};

    if (filters.agent_id) {
      conditions.push(sql`agent_id = ${filters.agent_id}`);
    }
    if (filters.task_type) {
      conditions.push(sql`task_type = ${filters.task_type}`);
    }
    if (filters.status) {
      conditions.push(sql`status = ${filters.status}`);
    }
    if (filters.outcome) {
      conditions.push(sql`outcome = ${filters.outcome}`);
    }

    const whereClause = conditions.length > 0 ? sql`WHERE ${sql.unsafe(conditions.map(() => '').join(' AND '))}` : sql``;

    return sql<DBTrajectory[]>`
      SELECT * FROM trajectories
      ${conditions.length > 0 ? sql`WHERE ${sql(conditions, sql` AND `)}` : sql``}
      ORDER BY created_at DESC
      LIMIT ${filters.limit}
      OFFSET ${filters.offset}
    `;
  },

  async updateTrajectoryOutcome(
    id: string,
    data: {
      outcome: 'success' | 'failure' | 'partial';
      final_result?: Record<string, unknown> | null;
      total_duration_ms?: number | null;
    }
  ): Promise<DBTrajectory | null> {
    const [trajectory] = await sql<DBTrajectory[]>`
      UPDATE trajectories
      SET
        outcome = ${data.outcome},
        status = 'completed',
        final_result = ${data.final_result ? sql.json(data.final_result) : null},
        total_duration_ms = ${data.total_duration_ms ?? null},
        completed_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    return trajectory || null;
  },

  async checkTrajectoryExists(id: string): Promise<boolean> {
    const [result] = await sql<[{ exists: boolean }]>`
      SELECT EXISTS(SELECT 1 FROM trajectories WHERE id = ${id})
    `;
    return result.exists;
  },
};

export { sql };

// Graceful shutdown
process.on('SIGINT', async () => {
  await sql.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await sql.end();
  process.exit(0);
});
