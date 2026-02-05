import { z } from 'zod';

// =============================================================================
// Approval Types
// =============================================================================

export const ApprovalStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'expired',
]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const ApprovalRequestSchema = z.object({
  id: z.string().uuid(),
  versionId: z.string().uuid(),
  agentId: z.string(),
  requestedBy: z.string().uuid(),
  requestedAt: z.date(),
  requiredApprovals: z.number().int().min(1),
  currentApprovals: z.number().int().min(0),
  status: ApprovalStatusSchema,
  expiresAt: z.date().nullable(),
});
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

export const ApprovalVoteSchema = z.object({
  id: z.string().uuid(),
  approvalRequestId: z.string().uuid(),
  approverId: z.string().uuid(),
  vote: z.enum(['approve', 'reject']),
  reason: z.string().nullable(),
  votedAt: z.date(),
});
export type ApprovalVote = z.infer<typeof ApprovalVoteSchema>;

export const ApprovalStatusResponseSchema = z.object({
  request: ApprovalRequestSchema,
  votes: z.array(ApprovalVoteSchema),
  canDeploy: z.boolean(),
});
export type ApprovalStatusResponse = z.infer<typeof ApprovalStatusResponseSchema>;

// =============================================================================
// Deployment Types
// =============================================================================

export const DeploymentStatusSchema = z.enum([
  'pending',
  'deploying',
  'active',
  'rolled_back',
  'superseded',
]);
export type DeploymentStatus = z.infer<typeof DeploymentStatusSchema>;

export const DeploymentSchema = z.object({
  id: z.string().uuid(),
  versionId: z.string().uuid(),
  agentId: z.string(),
  deployedBy: z.string().uuid(),
  deployedAt: z.date(),
  status: DeploymentStatusSchema,
  previousDeploymentId: z.string().uuid().nullable(),
  metricsBaseline: z.any().nullable(),
  metricsPostDeployment: z.any().nullable(),
  regressionDetected: z.boolean(),
  rolledBackAt: z.date().nullable(),
  rolledBackBy: z.string().uuid().nullable(),
  rollbackReason: z.string().nullable(),
});
export type Deployment = z.infer<typeof DeploymentSchema>;

// =============================================================================
// Metrics Types
// =============================================================================

export const DeploymentMetricsSchema = z.object({
  successRate: z.number().min(0).max(1),
  avgEfficiency: z.number().min(0),
  errorRate: z.number().min(0).max(1),
  trajectoryCount: z.number().int().min(0),
  avgSteps: z.number().min(0),
  avgDurationMs: z.number().min(0),
  period: z.object({
    start: z.date(),
    end: z.date(),
  }),
});
export type DeploymentMetrics = z.infer<typeof DeploymentMetricsSchema>;

export const MetricsComparisonSchema = z.object({
  baseline: DeploymentMetricsSchema,
  current: DeploymentMetricsSchema,
  successRateChange: z.number(),
  efficiencyChange: z.number(),
  errorRateChange: z.number(),
  sampleSizeSufficient: z.boolean(),
  statisticallySignificant: z.boolean(),
});
export type MetricsComparison = z.infer<typeof MetricsComparisonSchema>;

// =============================================================================
// Regression Types
// =============================================================================

export const RegressionSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export type RegressionSeverity = z.infer<typeof RegressionSeveritySchema>;

export const RegressionConfigSchema = z.object({
  successRateThreshold: z.number().min(0).max(1).default(0.05),
  efficiencyThreshold: z.number().min(0).max(1).default(0.10),
  minSampleSize: z.number().int().min(1).default(50),
  evaluationWindowMinutes: z.number().int().min(1).default(30),
});
export type RegressionConfig = z.infer<typeof RegressionConfigSchema>;

export const RegressionReportSchema = z.object({
  deploymentId: z.string().uuid(),
  detected: z.boolean(),
  severity: RegressionSeveritySchema.nullable(),
  metrics: MetricsComparisonSchema,
  recommendations: z.array(z.string()),
  evaluatedAt: z.date(),
  autoRollbackTriggered: z.boolean(),
});
export type RegressionReport = z.infer<typeof RegressionReportSchema>;

// =============================================================================
// Notification Types
// =============================================================================

export const NotificationTypeSchema = z.enum([
  'approval_needed',
  'approval_received',
  'approval_rejected',
  'deployed',
  'regression_detected',
  'rollback',
  'rollback_complete',
]);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const NotificationSchema = z.object({
  type: NotificationTypeSchema,
  message: z.string(),
  metadata: z.record(z.any()),
  timestamp: z.date().default(() => new Date()),
});
export type Notification = z.infer<typeof NotificationSchema>;

// =============================================================================
// Prompt Version Types (extended for deployment)
// =============================================================================

export const PromptVersionSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string(),
  branchId: z.string().uuid().nullable(),
  version: z.number().int(),
  content: z.object({
    systemPrompt: z.string(),
    toolDescriptions: z.record(z.string(), z.string()),
    subagentPrompts: z.record(z.string(), z.string()).optional(),
  }),
  status: z.enum(['candidate', 'approved', 'production', 'retired']),
  fitness: z.any().nullable(),
  createdAt: z.date(),
  createdBy: z.enum(['evolution', 'manual']),
  approvedBy: z.array(z.string()),
  deployedAt: z.date().nullable(),
});
export type PromptVersion = z.infer<typeof PromptVersionSchema>;

// =============================================================================
// Reviewer Types
// =============================================================================

export const ReviewerRoleSchema = z.enum(['reviewer', 'developer', 'admin']);
export type ReviewerRole = z.infer<typeof ReviewerRoleSchema>;

export const ReviewerSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: ReviewerRoleSchema,
  createdAt: z.date(),
  lastActiveAt: z.date().nullable(),
});
export type Reviewer = z.infer<typeof ReviewerSchema>;

// =============================================================================
// API Request/Response Types
// =============================================================================

export const RequestApprovalInputSchema = z.object({
  versionId: z.string().uuid(),
  requestedBy: z.string().uuid(),
  requiredApprovals: z.number().int().min(1).default(1),
  expiresInHours: z.number().int().min(1).optional(),
});
export type RequestApprovalInput = z.infer<typeof RequestApprovalInputSchema>;

export const ApproveInputSchema = z.object({
  versionId: z.string().uuid(),
  approverId: z.string().uuid(),
  reason: z.string().optional(),
});
export type ApproveInput = z.infer<typeof ApproveInputSchema>;

export const RejectInputSchema = z.object({
  versionId: z.string().uuid(),
  approverId: z.string().uuid(),
  reason: z.string(),
});
export type RejectInput = z.infer<typeof RejectInputSchema>;

export const DeployInputSchema = z.object({
  versionId: z.string().uuid(),
  deployedBy: z.string().uuid(),
});
export type DeployInput = z.infer<typeof DeployInputSchema>;

export const RollbackInputSchema = z.object({
  deploymentId: z.string().uuid(),
  rolledBackBy: z.string().uuid(),
  reason: z.string().optional(),
});
export type RollbackInput = z.infer<typeof RollbackInputSchema>;
