-- Agent Lightning Prompt Optimizer - Database Schema
-- PostgreSQL 14+

-- =============================================================================
-- EXTENSIONS
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- TYPES
-- =============================================================================

-- Trajectory status enum
CREATE TYPE trajectory_status AS ENUM ('completed', 'failed', 'timeout', 'partial');

-- Prompt version status enum
CREATE TYPE prompt_version_status AS ENUM ('candidate', 'approved', 'production', 'retired');

-- Prompt version creator enum
CREATE TYPE prompt_creator AS ENUM ('evolution', 'manual');

-- Reviewer role enum
CREATE TYPE reviewer_role AS ENUM ('reviewer', 'developer', 'admin');

-- Review queue status enum
CREATE TYPE review_status AS ENUM ('pending', 'completed', 'skipped', 'expired');

-- =============================================================================
-- TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- reviewers: Users who can review comparisons and deploy prompts
-- -----------------------------------------------------------------------------
CREATE TABLE reviewers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role reviewer_role NOT NULL DEFAULT 'reviewer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ
);

COMMENT ON TABLE reviewers IS 'Users who review trajectory comparisons and manage deployments';
COMMENT ON COLUMN reviewers.role IS 'User role: reviewer (can only review), developer (can approve), admin (full access)';

-- -----------------------------------------------------------------------------
-- agents: Agent definitions and metadata
-- -----------------------------------------------------------------------------
CREATE TABLE agents (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    current_production_version_id UUID, -- FK added after prompt_versions created
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE agents IS 'Agent definitions with their current production prompt version';
COMMENT ON COLUMN agents.id IS 'Unique identifier (e.g., oh-my-claudecode:executor)';

-- -----------------------------------------------------------------------------
-- branches: Version branches for prompt evolution
-- -----------------------------------------------------------------------------
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(255) NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    parent_branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_main BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT unique_agent_branch UNIQUE(agent_id, name)
);

COMMENT ON TABLE branches IS 'Branches for parallel prompt version development';
COMMENT ON COLUMN branches.is_main IS 'Whether this is the main/production branch';

-- Ensure only one main branch per agent
CREATE UNIQUE INDEX idx_branches_single_main ON branches (agent_id) WHERE is_main = TRUE;

-- -----------------------------------------------------------------------------
-- prompt_versions: Versioned prompt content with evolution metadata
-- -----------------------------------------------------------------------------
CREATE TABLE prompt_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(255) NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    version INTEGER NOT NULL,
    content JSONB NOT NULL,
    -- Evolution lineage
    parent_ids UUID[] DEFAULT '{}',
    mutation_type VARCHAR(100),
    mutation_details JSONB,
    -- Fitness metrics
    fitness JSONB DEFAULT '{"winRate": null, "successRate": null, "avgEfficiency": null, "comparisonCount": 0}',
    -- Lifecycle
    status prompt_version_status NOT NULL DEFAULT 'candidate',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by prompt_creator NOT NULL DEFAULT 'manual',
    approved_by VARCHAR(255)[] DEFAULT '{}',
    deployed_at TIMESTAMPTZ,

    CONSTRAINT unique_agent_branch_version UNIQUE(agent_id, branch_id, version)
);

COMMENT ON TABLE prompt_versions IS 'Versioned prompts with evolution lineage and fitness tracking';
COMMENT ON COLUMN prompt_versions.content IS 'Prompt content: {systemPrompt, toolDescriptions, subagentPrompts}';
COMMENT ON COLUMN prompt_versions.parent_ids IS 'Parent version IDs for crossover/mutation lineage';
COMMENT ON COLUMN prompt_versions.mutation_type IS 'Type of mutation: rephrase, add_constraint, remove_section, crossover, etc.';
COMMENT ON COLUMN prompt_versions.fitness IS 'Computed fitness: {winRate, successRate, avgEfficiency, comparisonCount}';

-- Add FK for agents.current_production_version_id
ALTER TABLE agents
ADD CONSTRAINT fk_agents_current_version
FOREIGN KEY (current_production_version_id) REFERENCES prompt_versions(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- trajectories: Agent execution traces
-- -----------------------------------------------------------------------------
CREATE TABLE trajectories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) NOT NULL,
    agent_id VARCHAR(255) NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    prompt_version_id UUID REFERENCES prompt_versions(id) ON DELETE SET NULL,
    task_type VARCHAR(100),
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    status trajectory_status NOT NULL DEFAULT 'completed',
    steps JSONB NOT NULL DEFAULT '[]',
    outcome JSONB,
    metrics JSONB DEFAULT '{"totalTokens": 0, "totalSteps": 0, "durationMs": 0}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE trajectories IS 'Agent execution trajectories for training and comparison';
COMMENT ON COLUMN trajectories.session_id IS 'Claude Code session identifier';
COMMENT ON COLUMN trajectories.steps IS 'Array of TrajectoryStep: {type, input, output, toolCalls, tokens, durationMs}';
COMMENT ON COLUMN trajectories.outcome IS 'Execution outcome: {success: boolean, error?: string, artifacts?: any}';
COMMENT ON COLUMN trajectories.metrics IS 'Aggregated metrics: {totalTokens, totalSteps, durationMs}';

-- -----------------------------------------------------------------------------
-- comparison_feedback: Human preference data for training
-- -----------------------------------------------------------------------------
CREATE TABLE comparison_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trajectory_a_id UUID NOT NULL REFERENCES trajectories(id) ON DELETE CASCADE,
    trajectory_b_id UUID NOT NULL REFERENCES trajectories(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES reviewers(id) ON DELETE CASCADE,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ratings JSONB NOT NULL,
    comment TEXT,
    skipped BOOLEAN NOT NULL DEFAULT FALSE,
    skip_reason TEXT,

    CONSTRAINT different_trajectories CHECK (trajectory_a_id != trajectory_b_id)
);

COMMENT ON TABLE comparison_feedback IS 'Human preference feedback comparing two trajectories';
COMMENT ON COLUMN comparison_feedback.ratings IS 'Rating data: {aSuccess: 1-5, bSuccess: 1-5, aEfficiency: 1-5, bEfficiency: 1-5, preference: "a"|"b"|"tie"}';

-- -----------------------------------------------------------------------------
-- review_queue: Pending comparison reviews
-- -----------------------------------------------------------------------------
CREATE TABLE review_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reviewer_id UUID REFERENCES reviewers(id) ON DELETE CASCADE,
    trajectory_a_id UUID NOT NULL REFERENCES trajectories(id) ON DELETE CASCADE,
    trajectory_b_id UUID NOT NULL REFERENCES trajectories(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status review_status NOT NULL DEFAULT 'pending',
    priority INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT different_queue_trajectories CHECK (trajectory_a_id != trajectory_b_id)
);

COMMENT ON TABLE review_queue IS 'Queue of trajectory pairs awaiting human review';
COMMENT ON COLUMN review_queue.priority IS 'Higher values = higher priority for review';

-- -----------------------------------------------------------------------------
-- deployments: Prompt deployment history
-- -----------------------------------------------------------------------------
CREATE TABLE deployments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_version_id UUID NOT NULL REFERENCES prompt_versions(id) ON DELETE CASCADE,
    deployed_by UUID NOT NULL REFERENCES reviewers(id) ON DELETE CASCADE,
    deployed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rolled_back_at TIMESTAMPTZ,
    rolled_back_by UUID REFERENCES reviewers(id) ON DELETE SET NULL,
    metrics_before JSONB,
    metrics_after JSONB,
    regression_detected BOOLEAN NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE deployments IS 'Deployment history for prompt versions with rollback tracking';
COMMENT ON COLUMN deployments.metrics_before IS 'Agent performance metrics before deployment';
COMMENT ON COLUMN deployments.metrics_after IS 'Agent performance metrics after deployment';
COMMENT ON COLUMN deployments.regression_detected IS 'Whether automated monitoring detected regression';

-- =============================================================================
-- INDEXES
-- =============================================================================

-- trajectories indexes
CREATE INDEX idx_trajectories_agent_id ON trajectories(agent_id);
CREATE INDEX idx_trajectories_prompt_version_id ON trajectories(prompt_version_id);
CREATE INDEX idx_trajectories_task_type ON trajectories(task_type);
CREATE INDEX idx_trajectories_created_at ON trajectories(created_at DESC);
CREATE INDEX idx_trajectories_session_id ON trajectories(session_id);
CREATE INDEX idx_trajectories_status ON trajectories(status);

-- prompt_versions indexes
CREATE INDEX idx_prompt_versions_agent_id ON prompt_versions(agent_id);
CREATE INDEX idx_prompt_versions_branch_id ON prompt_versions(branch_id);
CREATE INDEX idx_prompt_versions_status ON prompt_versions(status);
CREATE INDEX idx_prompt_versions_created_at ON prompt_versions(created_at DESC);

-- comparison_feedback indexes
CREATE INDEX idx_comparison_feedback_reviewer_id ON comparison_feedback(reviewer_id);
CREATE INDEX idx_comparison_feedback_trajectory_a ON comparison_feedback(trajectory_a_id);
CREATE INDEX idx_comparison_feedback_trajectory_b ON comparison_feedback(trajectory_b_id);
CREATE INDEX idx_comparison_feedback_reviewed_at ON comparison_feedback(reviewed_at DESC);

-- review_queue indexes
CREATE INDEX idx_review_queue_reviewer_id ON review_queue(reviewer_id);
CREATE INDEX idx_review_queue_status ON review_queue(status);
CREATE INDEX idx_review_queue_priority ON review_queue(priority DESC);
CREATE INDEX idx_review_queue_pending ON review_queue(reviewer_id, status) WHERE status = 'pending';

-- deployments indexes
CREATE INDEX idx_deployments_prompt_version_id ON deployments(prompt_version_id);
CREATE INDEX idx_deployments_deployed_at ON deployments(deployed_at DESC);

-- branches indexes
CREATE INDEX idx_branches_agent_id ON branches(agent_id);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Update agents.updated_at on modification
CREATE OR REPLACE FUNCTION update_agents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_agents_updated_at
    BEFORE UPDATE ON agents
    FOR EACH ROW
    EXECUTE FUNCTION update_agents_updated_at();

-- Update reviewer last_active_at when they submit feedback
CREATE OR REPLACE FUNCTION update_reviewer_last_active()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE reviewers SET last_active_at = NOW() WHERE id = NEW.reviewer_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_reviewer_activity_feedback
    AFTER INSERT ON comparison_feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_reviewer_last_active();

-- Auto-update review_queue status when feedback submitted
CREATE OR REPLACE FUNCTION update_review_queue_on_feedback()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE review_queue
    SET status = CASE WHEN NEW.skipped THEN 'skipped' ELSE 'completed' END
    WHERE reviewer_id = NEW.reviewer_id
      AND trajectory_a_id = NEW.trajectory_a_id
      AND trajectory_b_id = NEW.trajectory_b_id
      AND status = 'pending';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_review_queue_completion
    AFTER INSERT ON comparison_feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_review_queue_on_feedback();

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Get next version number for an agent on a branch
CREATE OR REPLACE FUNCTION get_next_version(p_agent_id VARCHAR, p_branch_id UUID)
RETURNS INTEGER AS $$
DECLARE
    next_ver INTEGER;
BEGIN
    SELECT COALESCE(MAX(version), 0) + 1 INTO next_ver
    FROM prompt_versions
    WHERE agent_id = p_agent_id AND branch_id = p_branch_id;
    RETURN next_ver;
END;
$$ LANGUAGE plpgsql;

-- Calculate fitness from comparison feedback
CREATE OR REPLACE FUNCTION calculate_fitness(p_version_id UUID)
RETURNS JSONB AS $$
DECLARE
    wins INTEGER := 0;
    losses INTEGER := 0;
    ties INTEGER := 0;
    total INTEGER := 0;
    success_count INTEGER := 0;
    efficiency_sum NUMERIC := 0;
    win_rate NUMERIC;
    success_rate NUMERIC;
    avg_efficiency NUMERIC;
BEGIN
    -- Count wins/losses/ties from comparisons
    SELECT
        COUNT(*) FILTER (WHERE
            (trajectory_a_id IN (SELECT id FROM trajectories WHERE prompt_version_id = p_version_id) AND ratings->>'preference' = 'a') OR
            (trajectory_b_id IN (SELECT id FROM trajectories WHERE prompt_version_id = p_version_id) AND ratings->>'preference' = 'b')
        ),
        COUNT(*) FILTER (WHERE
            (trajectory_a_id IN (SELECT id FROM trajectories WHERE prompt_version_id = p_version_id) AND ratings->>'preference' = 'b') OR
            (trajectory_b_id IN (SELECT id FROM trajectories WHERE prompt_version_id = p_version_id) AND ratings->>'preference' = 'a')
        ),
        COUNT(*) FILTER (WHERE ratings->>'preference' = 'tie'),
        COUNT(*)
    INTO wins, losses, ties, total
    FROM comparison_feedback
    WHERE NOT skipped
      AND (trajectory_a_id IN (SELECT id FROM trajectories WHERE prompt_version_id = p_version_id)
           OR trajectory_b_id IN (SELECT id FROM trajectories WHERE prompt_version_id = p_version_id));

    -- Calculate success rate from trajectories
    SELECT
        COUNT(*) FILTER (WHERE outcome->>'success' = 'true'),
        COUNT(*)
    INTO success_count, total
    FROM trajectories
    WHERE prompt_version_id = p_version_id;

    -- Calculate rates
    IF total > 0 THEN
        win_rate := (wins::NUMERIC + ties::NUMERIC * 0.5) / (wins + losses + ties);
        success_rate := success_count::NUMERIC / total;
    ELSE
        win_rate := NULL;
        success_rate := NULL;
    END IF;

    RETURN jsonb_build_object(
        'winRate', win_rate,
        'successRate', success_rate,
        'avgEfficiency', avg_efficiency,
        'comparisonCount', wins + losses + ties
    );
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- DEPLOYMENT & APPROVAL TABLES
-- =============================================================================

-- Approval status enum
DO $$ BEGIN
    CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Deployment status enum
DO $$ BEGIN
    CREATE TYPE deployment_status AS ENUM ('pending', 'deploying', 'active', 'rolled_back', 'superseded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Regression severity enum
DO $$ BEGIN
    CREATE TYPE regression_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- -----------------------------------------------------------------------------
-- approval_requests: Workflow for prompt version deployment approval
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS approval_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES prompt_versions(id) ON DELETE CASCADE,
    agent_id VARCHAR(255) NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES reviewers(id) ON DELETE CASCADE,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    required_approvals INTEGER NOT NULL DEFAULT 1,
    current_approvals INTEGER NOT NULL DEFAULT 0,
    status approval_status NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ,

    CONSTRAINT unique_version_approval UNIQUE(version_id)
);

COMMENT ON TABLE approval_requests IS 'Approval workflow for prompt version deployment';
COMMENT ON COLUMN approval_requests.required_approvals IS 'Number of approvals needed before deployment';
COMMENT ON COLUMN approval_requests.current_approvals IS 'Current number of approvals received';

-- -----------------------------------------------------------------------------
-- approval_votes: Individual votes on approval requests
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS approval_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    approval_request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
    approver_id UUID NOT NULL REFERENCES reviewers(id) ON DELETE CASCADE,
    vote VARCHAR(20) NOT NULL CHECK (vote IN ('approve', 'reject')),
    reason TEXT,
    voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_approver_vote UNIQUE(approval_request_id, approver_id)
);

COMMENT ON TABLE approval_votes IS 'Individual votes on prompt version approval requests';

-- -----------------------------------------------------------------------------
-- Add status and previous_deployment_id to deployments if not exists
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'deployments' AND column_name = 'status'
    ) THEN
        ALTER TABLE deployments ADD COLUMN status deployment_status DEFAULT 'active';
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
END $$;

-- -----------------------------------------------------------------------------
-- regression_reports: Automated regression detection results
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS regression_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    detected BOOLEAN NOT NULL,
    severity regression_severity,
    metrics JSONB NOT NULL,
    recommendations TEXT[],
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    auto_rollback_triggered BOOLEAN NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE regression_reports IS 'Automated regression detection reports for deployments';
COMMENT ON COLUMN regression_reports.detected IS 'Whether regression was detected';
COMMENT ON COLUMN regression_reports.severity IS 'Severity level if regression detected';
COMMENT ON COLUMN regression_reports.metrics IS 'Metrics comparison data';
COMMENT ON COLUMN regression_reports.auto_rollback_triggered IS 'Whether auto-rollback was triggered';

-- =============================================================================
-- DEPLOYMENT & APPROVAL INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_version ON approval_requests(version_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_pending ON approval_requests(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_approval_votes_request ON approval_votes(approval_request_id);
CREATE INDEX IF NOT EXISTS idx_regression_reports_deployment ON regression_reports(deployment_id);
CREATE INDEX IF NOT EXISTS idx_regression_reports_detected ON regression_reports(detected) WHERE detected = true;

-- =============================================================================
-- DEPLOYMENT & APPROVAL TRIGGERS
-- =============================================================================

-- Update reviewer activity on approval votes
CREATE OR REPLACE FUNCTION update_reviewer_on_vote()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE reviewers SET last_active_at = NOW() WHERE id = NEW.approver_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_reviewer_activity_vote ON approval_votes;
CREATE TRIGGER trigger_reviewer_activity_vote
    AFTER INSERT ON approval_votes
    FOR EACH ROW
    EXECUTE FUNCTION update_reviewer_on_vote();

-- Auto-expire approval requests
CREATE OR REPLACE FUNCTION expire_approval_requests()
RETURNS void AS $$
BEGIN
    UPDATE approval_requests
    SET status = 'expired'
    WHERE status = 'pending'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
