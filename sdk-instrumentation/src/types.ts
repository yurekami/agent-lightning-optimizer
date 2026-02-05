/**
 * Type definitions for Agent Lightning trajectory data structures
 */

export interface TrajectoryStep {
  stepNumber: number;
  timestamp: string;
  toolName: string;
  toolInput: any;
  toolOutput?: any;
  error?: string;
  thinking?: string;
  metadata?: Record<string, any>;
}

export interface Outcome {
  success: boolean;
  result?: any;
  error?: string;
  totalSteps: number;
  duration: number;
  metadata?: Record<string, any>;
}

export interface Trajectory {
  id: string;
  agentId: string;
  taskType?: string;
  startTime: string;
  endTime?: string;
  steps: TrajectoryStep[];
  outcome?: Outcome;
  metadata?: Record<string, any>;
}

export interface InstrumentationConfig {
  collectorUrl: string;
  apiKey: string;
  agentId: string;
  taskType?: string;
  enabled?: boolean;
  batchSize?: number;
  flushInterval?: number;
  debug?: boolean;
}

export interface Hooks {
  SessionStart?: (context: any) => Promise<void>;
  PreToolUse?: (toolName: string, input: any, context?: any) => Promise<void>;
  PostToolUse?: (toolName: string, input: any, output: any, context?: any) => Promise<void>;
  Stop?: (result: any, context?: any) => Promise<void>;
}

export interface InstrumentationResult {
  hooks: Hooks;
  flush: () => Promise<void>;
  getSessionId: () => string;
  getTrajectoryId: () => string;
  complete: (outcome: Outcome) => Promise<void>;
}
