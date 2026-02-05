import { v4 as uuidv4 } from 'uuid';
import { db, TrajectoryWithSteps } from '../db';
import {
  TrajectoryInput,
  TrajectoryFilters,
  TrajectoryStepInput,
  CompleteTrajectoryInput,
  TrajectoryResponse,
} from '../schemas';

export const trajectoryService = {
  async createTrajectory(data: TrajectoryInput): Promise<TrajectoryResponse> {
    const trajectoryId = uuidv4();

    const trajectory = await db.insertTrajectory({
      id: trajectoryId,
      agent_id: data.agent_id,
      task_type: data.task_type,
      initial_prompt: data.initial_prompt,
      outcome: data.outcome,
      status: 'completed',
      final_result: data.final_result ?? null,
      metadata: data.metadata ?? null,
      total_duration_ms: data.total_duration_ms ?? null,
      created_at: data.created_at ? new Date(data.created_at) : undefined,
    });

    const steps = await db.insertTrajectorySteps(
      trajectoryId,
      data.steps.map((step) => ({
        id: uuidv4(),
        step_number: step.step_number,
        timestamp: new Date(step.timestamp),
        tool_name: step.tool_name,
        tool_input: step.tool_input,
        tool_output: step.tool_output ?? null,
        thinking_content: step.thinking_content ?? null,
        error: step.error ?? null,
        duration_ms: step.duration_ms ?? null,
      }))
    );

    return this.formatTrajectoryResponse({ ...trajectory, steps });
  },

  async startTrajectory(data: {
    agent_id: string;
    task_type: string;
    initial_prompt: string;
    metadata?: Record<string, unknown>;
  }): Promise<TrajectoryResponse> {
    const trajectoryId = uuidv4();

    const trajectory = await db.insertTrajectory({
      id: trajectoryId,
      agent_id: data.agent_id,
      task_type: data.task_type,
      initial_prompt: data.initial_prompt,
      status: 'in_progress',
      metadata: data.metadata ?? null,
    });

    return this.formatTrajectoryResponse({ ...trajectory, steps: [] });
  },

  async appendStep(
    trajectoryId: string,
    step: TrajectoryStepInput
  ): Promise<void> {
    const exists = await db.checkTrajectoryExists(trajectoryId);
    if (!exists) {
      throw new Error('Trajectory not found');
    }

    await db.insertTrajectorySteps(trajectoryId, [
      {
        id: uuidv4(),
        step_number: step.step_number,
        timestamp: new Date(step.timestamp),
        tool_name: step.tool_name,
        tool_input: step.tool_input,
        tool_output: step.tool_output ?? null,
        thinking_content: step.thinking_content ?? null,
        error: step.error ?? null,
        duration_ms: step.duration_ms ?? null,
      },
    ]);
  },

  async completeTrajectory(
    id: string,
    data: CompleteTrajectoryInput
  ): Promise<TrajectoryResponse> {
    const trajectory = await db.updateTrajectoryOutcome(id, {
      outcome: data.outcome,
      final_result: data.final_result ?? null,
      total_duration_ms: data.total_duration_ms ?? null,
    });

    if (!trajectory) {
      throw new Error('Trajectory not found');
    }

    const withSteps = await db.getTrajectoryById(id);
    if (!withSteps) {
      throw new Error('Failed to retrieve updated trajectory');
    }

    return this.formatTrajectoryResponse(withSteps);
  },

  async getTrajectory(id: string): Promise<TrajectoryResponse | null> {
    const trajectory = await db.getTrajectoryById(id);
    if (!trajectory) return null;

    return this.formatTrajectoryResponse(trajectory);
  },

  async listTrajectories(filters: TrajectoryFilters): Promise<TrajectoryResponse[]> {
    const trajectories = await db.listTrajectories({
      agent_id: filters.agent_id,
      task_type: filters.task_type,
      status: filters.status,
      outcome: filters.outcome,
      limit: filters.limit,
      offset: filters.offset,
    });

    return trajectories.map((t) => this.formatTrajectoryResponse({ ...t, steps: [] }));
  },

  formatTrajectoryResponse(data: TrajectoryWithSteps): TrajectoryResponse {
    return {
      id: data.id,
      agent_id: data.agent_id,
      task_type: data.task_type,
      initial_prompt: data.initial_prompt,
      outcome: data.outcome,
      status: data.status,
      final_result: data.final_result,
      metadata: data.metadata,
      total_duration_ms: data.total_duration_ms,
      created_at: data.created_at.toISOString(),
      completed_at: data.completed_at ? data.completed_at.toISOString() : null,
      steps: data.steps?.map((step) => ({
        id: step.id,
        step_number: step.step_number,
        timestamp: step.timestamp.toISOString(),
        tool_name: step.tool_name,
        tool_input: step.tool_input,
        tool_output: step.tool_output,
        thinking_content: step.thinking_content,
        error: step.error,
        duration_ms: step.duration_ms,
      })),
    };
  },
};
