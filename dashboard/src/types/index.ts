export interface Trajectory {
  id: string
  session_id: string
  agent_name: string
  prompt_version_id: string
  input_data: Record<string, any>
  started_at: Date
  completed_at: Date | null
  status: 'running' | 'completed' | 'failed'
  steps: TrajectoryStep[]
  metadata: Record<string, any>
}

export interface TrajectoryStep {
  id: string
  trajectory_id: string
  step_number: number
  prompt_text: string
  model_response: string
  tool_calls: ToolCall[]
  thinking_trace: string | null
  reward: number | null
  timestamp: Date
  metadata: Record<string, any>
}

export interface ToolCall {
  tool_name: string
  parameters: Record<string, any>
  result: any
  duration_ms: number
}

export interface PromptVersion {
  id: string
  agent_name: string
  version_number: number
  prompt_template: string
  parent_version_id: string | null
  branch_name: string
  is_active: boolean
  created_at: Date
  created_by: string
  training_config: Record<string, any>
  performance_metrics: PerformanceMetrics | null
}

export interface PerformanceMetrics {
  avg_reward: number
  success_rate: number
  avg_steps: number
  total_runs: number
  last_updated: Date
}

export interface ComparisonFeedback {
  id: string
  reviewer_id: string
  trajectory_a_id: string
  trajectory_b_id: string
  task_success_a: boolean
  task_success_b: boolean
  efficiency_a: number
  efficiency_b: number
  preference: 'A' | 'B' | 'tie'
  comment: string
  skip_reason?: string
  reviewed_at: Date
  metadata: Record<string, any>
}

export interface ComparisonItem {
  id: string
  trajectoryA: Trajectory
  trajectoryB: Trajectory
  taskType: string
  priority: number
  createdAt: Date
}

export interface ReviewStats {
  totalReviews: number
  reviewsToday: number
  reviewsThisWeek: number
  agreementRate: number
  currentStreak: number
  leaderboardPosition: number
  avgReviewTime: number
}

export interface Reviewer {
  id: string
  name: string
  email: string
  role: 'admin' | 'reviewer'
  created_at: Date
}

export interface Branch {
  id: string
  name: string
  agent_name: string
  base_version_id: string
  description: string
  created_at: Date
  created_by: string
  is_merged: boolean
  merged_at: Date | null
}

export interface ReviewSession {
  id: string
  reviewer_id: string
  trajectory_pairs: Array<{
    trajectory_a: Trajectory
    trajectory_b: Trajectory
  }>
  completed: boolean
  started_at: Date
  completed_at: Date | null
}

export interface TrainingRun {
  id: string
  agent_name: string
  prompt_version_id: string
  started_at: Date
  completed_at: Date | null
  status: 'pending' | 'running' | 'completed' | 'failed'
  config: Record<string, any>
  results: Record<string, any> | null
}

export type TimeRange = '24h' | '7d' | '30d' | '90d' | 'all'

export interface SystemMetrics {
  trajectories: {
    today: number
    week: number
    total: number
  }
  reviews: {
    today: number
    week: number
    total: number
  }
  agents: number
  generations: number
  mutations: number
  activeAgents: string[]
  populationSizes: Record<string, number>
}

export interface ReviewerStats {
  id: string
  name: string
  email: string
  role: string
  reviewCount: number
  agreementRate: number
  lastActive: Date | null
  streak: number
  avgReviewTime: number
  preferences: {
    A: number
    B: number
    tie: number
  }
}

export interface FitnessTrend {
  date: Date
  fitness: number
  winRate: number
  successRate: number
  efficiency: number
  generation: number
}

export interface ReliabilityMetrics {
  overallKappa: number
  pairwiseKappa: Record<string, Record<string, number>>
  sampleSize: number
  confusionMatrix: {
    AA: number
    AB: number
    ATie: number
    BA: number
    BB: number
    BTie: number
    TieA: number
    TieB: number
    TieTie: number
  }
}

export interface QueueHealth {
  currentDepth: number
  avgWaitTime: number
  comparisonsPerDay: number
  backlogAlert: boolean
  trends: {
    date: Date
    depth: number
    comparisons: number
  }[]
}

export interface AgentSummary {
  name: string
  productionVersion: string
  fitnessScore: number
  fitnessTrend: 'up' | 'down' | 'stable'
  trajectoryCount: number
  lastDeployment: Date | null
  activeBranches: number
  populationSize: number
}
