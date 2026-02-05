import postgres from 'postgres';
import type {
  ApprovalRequest,
  ApprovalVote,
  Deployment,
  DeploymentMetrics,
  PromptVersion,
  Reviewer,
  RegressionReport,
} from './types.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

export const sql = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export async function testConnection(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// =============================================================================
// Schema Initialization
// =============================================================================

export async function initializeDeployerSchema(): Promise<void> {
  // Create approval_requests table if not exists
  await sql`
    CREATE TABLE IF NOT EXISTS approval_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      version_id UUID NOT NULL REFERENCES prompt_versions(id) ON DELETE CASCADE,
      agent_id VARCHAR(255) NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      requested_by UUID NOT NULL REFERENCES reviewers(id) ON DELETE CASCADE,
      requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      required_approvals INTEGER NOT NULL DEFAULT 1,
      current_approvals INTEGER NOT NULL DEFAULT 0,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      expires_at TIMESTAMPTZ,
      CONSTRAINT unique_version_approval UNIQUE(version_id)
    )
  `;

  // Create approval_votes table if not exists
  await sql`
    CREATE TABLE IF NOT EXISTS approval_votes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      approval_request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
      approver_id UUID NOT NULL REFERENCES reviewers(id) ON DELETE CASCADE,
      vote VARCHAR(20) NOT NULL,
      reason TEXT,
      voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT unique_approver_vote UNIQUE(approval_request_id, approver_id)
    )
  `;

  // Add regression fields to deployments if they don't exist
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'deployments' AND column_name = 'status'
      ) THEN
        ALTER TABLE deployments ADD COLUMN status VARCHAR(50) DEFAULT 'active';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'deployments' AND column_name = 'previous_deployment_id'
      ) THEN
        ALTER TABLE deployments ADD COLUMN previous_deployment_id UUID REFERENCES deployments(id);
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'deployments' AND column_name = 'rollback_reason'
      ) THEN
        ALTER TABLE deployments ADD COLUMN rollback_reason TEXT;
      END IF;
    END $$
  `;

  // Create regression_reports table if not exists
  await sql`
    CREATE TABLE IF NOT EXISTS regression_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
      detected BOOLEAN NOT NULL,
      severity VARCHAR(20),
      metrics JSONB NOT NULL,
      recommendations TEXT[],
      evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      auto_rollback_triggered BOOLEAN NOT NULL DEFAULT FALSE
    )
  `;

  // Create indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_approval_requests_version ON approval_requests(version_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_approval_votes_request ON approval_votes(approval_request_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_regression_reports_deployment ON regression_reports(deployment_id)`;
}

// =============================================================================
// Approval Operations
// =============================================================================

export async function createApprovalRequest(data: {
  versionId: string;
  agentId: string;
  requestedBy: string;
  requiredApprovals: number;
  expiresAt: Date | null;
}): Promise<ApprovalRequest> {
  const [row] = await sql`
    INSERT INTO approval_requests (
      version_id, agent_id, requested_by, required_approvals, expires_at
    ) VALUES (
      ${data.versionId}, ${data.agentId}, ${data.requestedBy},
      ${data.requiredApprovals}, ${data.expiresAt}
    )
    RETURNING *
  `;

  return mapApprovalRequestRow(row);
}

export async function getApprovalRequest(versionId: string): Promise<ApprovalRequest | null> {
  const [row] = await sql`
    SELECT * FROM approval_requests WHERE version_id = ${versionId}
  `;

  return row ? mapApprovalRequestRow(row) : null;
}

export async function getApprovalRequestById(id: string): Promise<ApprovalRequest | null> {
  const [row] = await sql`
    SELECT * FROM approval_requests WHERE id = ${id}
  `;

  return row ? mapApprovalRequestRow(row) : null;
}

export async function listPendingApprovals(): Promise<ApprovalRequest[]> {
  const rows = await sql`
    SELECT ar.*, pv.version, pv.content, a.name as agent_name
    FROM approval_requests ar
    JOIN prompt_versions pv ON ar.version_id = pv.id
    JOIN agents a ON ar.agent_id = a.id
    WHERE ar.status = 'pending'
    AND (ar.expires_at IS NULL OR ar.expires_at > NOW())
    ORDER BY ar.requested_at DESC
  `;

  return rows.map(mapApprovalRequestRow);
}

export async function updateApprovalRequestStatus(
  id: string,
  status: string,
  currentApprovals: number
): Promise<void> {
  await sql`
    UPDATE approval_requests
    SET status = ${status}, current_approvals = ${currentApprovals}
    WHERE id = ${id}
  `;
}

export async function createApprovalVote(data: {
  approvalRequestId: string;
  approverId: string;
  vote: 'approve' | 'reject';
  reason: string | null;
}): Promise<ApprovalVote> {
  const [row] = await sql`
    INSERT INTO approval_votes (
      approval_request_id, approver_id, vote, reason
    ) VALUES (
      ${data.approvalRequestId}, ${data.approverId}, ${data.vote}, ${data.reason}
    )
    RETURNING *
  `;

  return mapApprovalVoteRow(row);
}

export async function getApprovalVotes(approvalRequestId: string): Promise<ApprovalVote[]> {
  const rows = await sql`
    SELECT * FROM approval_votes
    WHERE approval_request_id = ${approvalRequestId}
    ORDER BY voted_at ASC
  `;

  return rows.map(mapApprovalVoteRow);
}

export async function hasVoted(approvalRequestId: string, approverId: string): Promise<boolean> {
  const [row] = await sql`
    SELECT 1 FROM approval_votes
    WHERE approval_request_id = ${approvalRequestId} AND approver_id = ${approverId}
  `;

  return !!row;
}

// =============================================================================
// Deployment Operations
// =============================================================================

export async function createDeployment(data: {
  versionId: string;
  agentId: string;
  deployedBy: string;
  previousDeploymentId: string | null;
  metricsBaseline: DeploymentMetrics | null;
}): Promise<Deployment> {
  const [row] = await sql`
    INSERT INTO deployments (
      prompt_version_id, deployed_by, metrics_before,
      previous_deployment_id, regression_detected
    ) VALUES (
      ${data.versionId}, ${data.deployedBy}, ${JSON.stringify(data.metricsBaseline)},
      ${data.previousDeploymentId}, false
    )
    RETURNING *
  `;

  // Update prompt_version status to production
  await sql`
    UPDATE prompt_versions
    SET status = 'production', deployed_at = NOW()
    WHERE id = ${data.versionId}
  `;

  // Update agent's current production version
  await sql`
    UPDATE agents
    SET current_production_version_id = ${data.versionId}
    WHERE id = ${data.agentId}
  `;

  // Mark previous deployment as superseded
  if (data.previousDeploymentId) {
    await sql`
      UPDATE deployments
      SET status = 'superseded'
      WHERE id = ${data.previousDeploymentId}
    `;
  }

  return mapDeploymentRow(row);
}

export async function getDeployment(id: string): Promise<Deployment | null> {
  const [row] = await sql`
    SELECT d.*, pv.agent_id
    FROM deployments d
    JOIN prompt_versions pv ON d.prompt_version_id = pv.id
    WHERE d.id = ${id}
  `;

  return row ? mapDeploymentRow(row) : null;
}

export async function getCurrentDeployment(agentId: string): Promise<Deployment | null> {
  const [row] = await sql`
    SELECT d.*, pv.agent_id
    FROM deployments d
    JOIN prompt_versions pv ON d.prompt_version_id = pv.id
    WHERE pv.agent_id = ${agentId}
    AND d.rolled_back_at IS NULL
    AND (d.status = 'active' OR d.status IS NULL)
    ORDER BY d.deployed_at DESC
    LIMIT 1
  `;

  return row ? mapDeploymentRow(row) : null;
}

export async function getDeploymentHistory(
  agentId: string,
  limit: number = 20
): Promise<Deployment[]> {
  const rows = await sql`
    SELECT d.*, pv.agent_id, pv.version, r.name as deployed_by_name
    FROM deployments d
    JOIN prompt_versions pv ON d.prompt_version_id = pv.id
    JOIN reviewers r ON d.deployed_by = r.id
    WHERE pv.agent_id = ${agentId}
    ORDER BY d.deployed_at DESC
    LIMIT ${limit}
  `;

  return rows.map(mapDeploymentRow);
}

export async function updateDeploymentMetrics(
  id: string,
  metricsAfter: DeploymentMetrics,
  regressionDetected: boolean
): Promise<void> {
  await sql`
    UPDATE deployments
    SET metrics_after = ${JSON.stringify(metricsAfter)},
        regression_detected = ${regressionDetected}
    WHERE id = ${id}
  `;
}

export async function rollbackDeployment(
  id: string,
  rolledBackBy: string,
  reason: string | null
): Promise<void> {
  await sql`
    UPDATE deployments
    SET rolled_back_at = NOW(),
        rolled_back_by = ${rolledBackBy},
        rollback_reason = ${reason},
        status = 'rolled_back'
    WHERE id = ${id}
  `;
}

// =============================================================================
// Metrics Operations
// =============================================================================

export async function getTrajectoryMetrics(
  agentId: string,
  startTime: Date,
  endTime: Date
): Promise<DeploymentMetrics> {
  const [metrics] = await sql`
    SELECT
      COUNT(*) as total_count,
      COUNT(*) FILTER (WHERE outcome->>'success' = 'true') as success_count,
      COUNT(*) FILTER (WHERE status = 'failed') as error_count,
      AVG((metrics->>'totalSteps')::numeric) as avg_steps,
      AVG((metrics->>'durationMs')::numeric) as avg_duration_ms,
      AVG((metrics->>'efficiency')::numeric) as avg_efficiency
    FROM trajectories
    WHERE agent_id = ${agentId}
    AND created_at >= ${startTime}
    AND created_at <= ${endTime}
  `;

  const totalCount = Number(metrics.total_count) || 0;
  const successCount = Number(metrics.success_count) || 0;
  const errorCount = Number(metrics.error_count) || 0;

  return {
    successRate: totalCount > 0 ? successCount / totalCount : 0,
    avgEfficiency: Number(metrics.avg_efficiency) || 0,
    errorRate: totalCount > 0 ? errorCount / totalCount : 0,
    trajectoryCount: totalCount,
    avgSteps: Number(metrics.avg_steps) || 0,
    avgDurationMs: Number(metrics.avg_duration_ms) || 0,
    period: { start: startTime, end: endTime },
  };
}

export async function getVersionMetrics(
  versionId: string,
  startTime: Date,
  endTime: Date
): Promise<DeploymentMetrics> {
  const [metrics] = await sql`
    SELECT
      COUNT(*) as total_count,
      COUNT(*) FILTER (WHERE outcome->>'success' = 'true') as success_count,
      COUNT(*) FILTER (WHERE status = 'failed') as error_count,
      AVG((metrics->>'totalSteps')::numeric) as avg_steps,
      AVG((metrics->>'durationMs')::numeric) as avg_duration_ms,
      AVG((metrics->>'efficiency')::numeric) as avg_efficiency
    FROM trajectories
    WHERE prompt_version_id = ${versionId}
    AND created_at >= ${startTime}
    AND created_at <= ${endTime}
  `;

  const totalCount = Number(metrics.total_count) || 0;
  const successCount = Number(metrics.success_count) || 0;
  const errorCount = Number(metrics.error_count) || 0;

  return {
    successRate: totalCount > 0 ? successCount / totalCount : 0,
    avgEfficiency: Number(metrics.avg_efficiency) || 0,
    errorRate: totalCount > 0 ? errorCount / totalCount : 0,
    trajectoryCount: totalCount,
    avgSteps: Number(metrics.avg_steps) || 0,
    avgDurationMs: Number(metrics.avg_duration_ms) || 0,
    period: { start: startTime, end: endTime },
  };
}

// =============================================================================
// Regression Report Operations
// =============================================================================

export async function createRegressionReport(data: {
  deploymentId: string;
  detected: boolean;
  severity: string | null;
  metrics: object;
  recommendations: string[];
  autoRollbackTriggered: boolean;
}): Promise<RegressionReport> {
  const [row] = await sql`
    INSERT INTO regression_reports (
      deployment_id, detected, severity, metrics, recommendations, auto_rollback_triggered
    ) VALUES (
      ${data.deploymentId}, ${data.detected}, ${data.severity},
      ${JSON.stringify(data.metrics)}, ${data.recommendations}, ${data.autoRollbackTriggered}
    )
    RETURNING *
  `;

  return mapRegressionReportRow(row);
}

export async function getRegressionReport(deploymentId: string): Promise<RegressionReport | null> {
  const [row] = await sql`
    SELECT * FROM regression_reports
    WHERE deployment_id = ${deploymentId}
    ORDER BY evaluated_at DESC
    LIMIT 1
  `;

  return row ? mapRegressionReportRow(row) : null;
}

// =============================================================================
// Prompt Version Operations
// =============================================================================

export async function getPromptVersion(id: string): Promise<PromptVersion | null> {
  const [row] = await sql`
    SELECT * FROM prompt_versions WHERE id = ${id}
  `;

  return row ? mapPromptVersionRow(row) : null;
}

export async function updatePromptVersionStatus(
  id: string,
  status: string
): Promise<void> {
  await sql`
    UPDATE prompt_versions SET status = ${status} WHERE id = ${id}
  `;
}

// =============================================================================
// Reviewer Operations
// =============================================================================

export async function getReviewer(id: string): Promise<Reviewer | null> {
  const [row] = await sql`
    SELECT * FROM reviewers WHERE id = ${id}
  `;

  return row ? mapReviewerRow(row) : null;
}

export async function canApprove(reviewerId: string): Promise<boolean> {
  const reviewer = await getReviewer(reviewerId);
  return reviewer ? ['developer', 'admin'].includes(reviewer.role) : false;
}

// =============================================================================
// Row Mappers
// =============================================================================

function mapApprovalRequestRow(row: postgres.Row): ApprovalRequest {
  return {
    id: row.id,
    versionId: row.version_id,
    agentId: row.agent_id,
    requestedBy: row.requested_by,
    requestedAt: new Date(row.requested_at),
    requiredApprovals: row.required_approvals,
    currentApprovals: row.current_approvals,
    status: row.status,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
  };
}

function mapApprovalVoteRow(row: postgres.Row): ApprovalVote {
  return {
    id: row.id,
    approvalRequestId: row.approval_request_id,
    approverId: row.approver_id,
    vote: row.vote,
    reason: row.reason,
    votedAt: new Date(row.voted_at),
  };
}

function mapDeploymentRow(row: postgres.Row): Deployment {
  return {
    id: row.id,
    versionId: row.prompt_version_id,
    agentId: row.agent_id,
    deployedBy: row.deployed_by,
    deployedAt: new Date(row.deployed_at),
    status: row.status || 'active',
    previousDeploymentId: row.previous_deployment_id,
    metricsBaseline: row.metrics_before,
    metricsPostDeployment: row.metrics_after,
    regressionDetected: row.regression_detected,
    rolledBackAt: row.rolled_back_at ? new Date(row.rolled_back_at) : null,
    rolledBackBy: row.rolled_back_by,
    rollbackReason: row.rollback_reason,
  };
}

function mapRegressionReportRow(row: postgres.Row): RegressionReport {
  return {
    deploymentId: row.deployment_id,
    detected: row.detected,
    severity: row.severity,
    metrics: row.metrics,
    recommendations: row.recommendations || [],
    evaluatedAt: new Date(row.evaluated_at),
    autoRollbackTriggered: row.auto_rollback_triggered,
  };
}

function mapPromptVersionRow(row: postgres.Row): PromptVersion {
  return {
    id: row.id,
    agentId: row.agent_id,
    branchId: row.branch_id,
    version: row.version,
    content: row.content,
    status: row.status,
    fitness: row.fitness,
    createdAt: new Date(row.created_at),
    createdBy: row.created_by,
    approvedBy: row.approved_by || [],
    deployedAt: row.deployed_at ? new Date(row.deployed_at) : null,
  };
}

function mapReviewerRow(row: postgres.Row): Reviewer {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: new Date(row.created_at),
    lastActiveAt: row.last_active_at ? new Date(row.last_active_at) : null,
  };
}
