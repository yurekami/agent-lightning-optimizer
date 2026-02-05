import { z } from 'zod';

// ============================================================================
// Prompt Content Types
// ============================================================================

export const PromptContentSchema = z.object({
  systemPrompt: z.string(),
  toolDescriptions: z.record(z.string(), z.string()).optional().default({}),
  subagentPrompts: z.record(z.string(), z.string()).optional().default({}),
});

export type PromptContent = z.infer<typeof PromptContentSchema>;

// ============================================================================
// Prompt Version Types
// ============================================================================

export interface PromptVersion {
  id: string;
  agent_id: string;
  branch_id: string | null;
  version: number;
  content: PromptContent;
  parent_ids: string[];
  mutation_type: string | null;
  mutation_details: any;
  fitness: {
    winRate: number | null;
    successRate: number | null;
    avgEfficiency: number | null;
    comparisonCount: number;
  };
  status: 'candidate' | 'approved' | 'production' | 'retired';
  created_at: Date;
  created_by: 'evolution' | 'manual';
  approved_by: string[];
  deployed_at: Date | null;
}

// ============================================================================
// Mutation Types
// ============================================================================

export type MutationType =
  | 'rephrase_clarity'
  | 'add_examples'
  | 'remove_examples'
  | 'increase_verbosity'
  | 'decrease_verbosity'
  | 'add_edge_cases'
  | 'restructure_sections'
  | 'change_tone_formal'
  | 'change_tone_casual'
  | 'add_constraints'
  | 'simplify_instructions';

export interface MutationConfig {
  name: string;
  description: string;
  weight: number;
  complexity: 'simple' | 'medium' | 'complex';
  apply: (content: PromptContent, context: MutationContext) => Promise<PromptContent>;
}

export interface MutationContext {
  anthropic: any;
  model: string;
  maxRetries: number;
}

export interface MutationResult {
  success: boolean;
  mutatedContent?: PromptContent;
  error?: string;
  attempts: number;
  duration: number;
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata: {
    originalLength: number;
    mutatedLength: number;
    semanticSimilarity: number | null;
  };
}

// ============================================================================
// Database Types
// ============================================================================

export interface MutationRequest {
  id: string;
  prompt_version_id: string;
  mutation_type: MutationType;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  error: string | null;
  result_version_id: string | null;
}

// ============================================================================
// Service Configuration
// ============================================================================

export interface MutatorConfig {
  databaseUrl: string;
  anthropicApiKey: string;
  pollIntervalMs: number;
  batchSize: number;
  maxConcurrentMutations: number;
  defaultModel: string;
  complexModel: string;
  maxRetries: number;
  retryBackoffMs: number;
  minPromptLength: number;
  maxPromptLength: number;
  minSemanticSimilarity: number;
  logLevel: string;
}
