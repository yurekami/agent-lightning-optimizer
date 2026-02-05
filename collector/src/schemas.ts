import { z } from 'zod';

export const TrajectoryStepInputSchema = z.object({
  step_number: z.number().int().positive(),
  timestamp: z.string().datetime(),
  tool_name: z.string().min(1),
  tool_input: z.record(z.unknown()),
  tool_output: z.record(z.unknown()).nullable(),
  thinking_content: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  duration_ms: z.number().int().nonnegative().optional(),
});

export const TrajectoryInputSchema = z.object({
  agent_id: z.string().min(1),
  task_type: z.string().min(1),
  initial_prompt: z.string().min(1),
  steps: z.array(TrajectoryStepInputSchema).min(1),
  outcome: z.enum(['success', 'failure', 'partial']),
  final_result: z.record(z.unknown()).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
  total_duration_ms: z.number().int().nonnegative().optional(),
  created_at: z.string().datetime().optional(),
});

export const TrajectoryFiltersSchema = z.object({
  agent_id: z.string().optional(),
  task_type: z.string().optional(),
  status: z.enum(['in_progress', 'completed']).optional(),
  outcome: z.enum(['success', 'failure', 'partial']).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const StreamStepInputSchema = z.object({
  trajectory_id: z.string().uuid(),
  step: TrajectoryStepInputSchema,
});

export const CompleteTrajectoryInputSchema = z.object({
  outcome: z.enum(['success', 'failure', 'partial']),
  final_result: z.record(z.unknown()).nullable().optional(),
  total_duration_ms: z.number().int().nonnegative().optional(),
});

export const TrajectoryResponseSchema = z.object({
  id: z.string().uuid(),
  agent_id: z.string(),
  task_type: z.string(),
  initial_prompt: z.string(),
  outcome: z.enum(['success', 'failure', 'partial']).nullable(),
  status: z.enum(['in_progress', 'completed']),
  final_result: z.record(z.unknown()).nullable(),
  metadata: z.record(z.unknown()).nullable(),
  total_duration_ms: z.number().nullable(),
  created_at: z.string(),
  completed_at: z.string().nullable(),
  steps: z.array(z.object({
    id: z.string().uuid(),
    step_number: z.number(),
    timestamp: z.string(),
    tool_name: z.string(),
    tool_input: z.record(z.unknown()),
    tool_output: z.record(z.unknown()).nullable(),
    thinking_content: z.string().nullable(),
    error: z.string().nullable(),
    duration_ms: z.number().nullable(),
  })).optional(),
});

export type TrajectoryStepInput = z.infer<typeof TrajectoryStepInputSchema>;
export type TrajectoryInput = z.infer<typeof TrajectoryInputSchema>;
export type TrajectoryFilters = z.infer<typeof TrajectoryFiltersSchema>;
export type StreamStepInput = z.infer<typeof StreamStepInputSchema>;
export type CompleteTrajectoryInput = z.infer<typeof CompleteTrajectoryInputSchema>;
export type TrajectoryResponse = z.infer<typeof TrajectoryResponseSchema>;
