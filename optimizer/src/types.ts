import { z } from 'zod';

// ============================================================================
// Database Schema Types
// ============================================================================

export const AgentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
});

export type Agent = z.infer<typeof AgentSchema>;

export const EvolutionBranchSchema = z.object({
  id: z.string().uuid(),
  agent_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  parent_branch_id: z.string().uuid().nullable(),
  status: z.enum(['active', 'paused', 'archived']),
  created_at: z.date(),
  updated_at: z.date(),
});

export type EvolutionBranch = z.infer<typeof EvolutionBranchSchema>;

export const PromptContentSchema = z.object({
  systemPrompt: z.string(),
  toolDescriptions: z.record(z.string(), z.string()),
  subagentPrompts: z.record(z.string(), z.string()).optional(),
});

export type PromptContent = z.infer<typeof PromptContentSchema>;

export const PromptVersionSchema = z.object({
  id: z.string().uuid(),
  branch_id: z.string().uuid(),
  parent_version_id: z.string().uuid().nullable(),
  generation: z.number().int().min(0),
  content: PromptContentSchema,
  status: z.enum(['candidate', 'active', 'archived', 'rejected']),
  fitness_score: z.number().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
});

export type PromptVersion = z.infer<typeof PromptVersionSchema>;

export const ComparisonFeedbackSchema = z.object({
  id: z.string().uuid(),
  trajectory_a_id: z.string().uuid(),
  trajectory_b_id: z.string().uuid(),
  version_a_id: z.string().uuid(),
  version_b_id: z.string().uuid(),
  winner: z.enum(['a', 'b', 'tie']),
  confidence: z.number().min(0).max(1),
  feedback_source: z.enum(['human', 'llm', 'automated']),
  reasoning: z.string().nullable(),
  created_at: z.date(),
});

export type ComparisonFeedback = z.infer<typeof ComparisonFeedbackSchema>;

export const TrajectorySchema = z.object({
  id: z.string().uuid(),
  agent_id: z.string().uuid(),
  prompt_version_id: z.string().uuid(),
  session_id: z.string(),
  success: z.boolean().nullable(),
  efficiency_rating: z.number().nullable(),
  created_at: z.date(),
  completed_at: z.date().nullable(),
});

export type Trajectory = z.infer<typeof TrajectorySchema>;

// ============================================================================
// Fitness Types
// ============================================================================

export interface FitnessScore {
  winRate: number;
  successRate: number;
  avgEfficiency: number;
  comparisonCount: number;
  composite: number;
}

export const FitnessWeightsSchema = z.object({
  winRate: z.number().default(0.5),
  successRate: z.number().default(0.3),
  efficiency: z.number().default(0.2),
});

export type FitnessWeights = z.infer<typeof FitnessWeightsSchema>;

// ============================================================================
// Evolution Types
// ============================================================================

export const EvolutionConfigSchema = z.object({
  populationSize: z.number().int().min(2).default(20),
  eliteCount: z.number().int().min(0).default(2),
  tournamentSize: z.number().int().min(2).default(3),
  crossoverRate: z.number().min(0).max(1).default(0.7),
  mutationRate: z.number().min(0).max(1).default(0.3),
  plateauThreshold: z.number().int().min(1).default(5),
});

export type EvolutionConfig = z.infer<typeof EvolutionConfigSchema>;

export interface GenerationStats {
  generation: number;
  populationSize: number;
  avgFitness: number;
  maxFitness: number;
  minFitness: number;
  elitePreserved: number;
  crossovers: number;
  mutations: number;
  plateauDetected: boolean;
  adaptedMutationRate: number;
}

export interface EvolutionResult {
  newCandidates: PromptVersion[];
  stats: GenerationStats;
}

// ============================================================================
// Mutation Types
// ============================================================================

export const MutationType = z.enum([
  'rephrase_clarity',
  'add_examples',
  'remove_examples',
  'increase_verbosity',
  'decrease_verbosity',
  'add_edge_cases',
  'restructure_sections',
  'change_tone_formal',
  'change_tone_casual',
]);

export type MutationType = z.infer<typeof MutationType>;

export interface Mutation {
  type: MutationType;
  apply(content: PromptContent): Promise<PromptContent>;
}

export interface MutationResult {
  originalContent: PromptContent;
  mutatedContent: PromptContent;
  mutationType: MutationType;
  applied: boolean;
}

// ============================================================================
// Selection Types
// ============================================================================

export interface SelectionResult {
  parents: PromptVersion[];
  elites: PromptVersion[];
}

// ============================================================================
// Crossover Types
// ============================================================================

export type CrossoverType = 'single_point' | 'uniform';

export interface CrossoverResult {
  offspring: PromptContent;
  parent1Id: string;
  parent2Id: string;
  crossoverType: CrossoverType;
}
