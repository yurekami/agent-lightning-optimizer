-- Migration: 001_initial_schema
-- Description: Initial database schema for Agent Lightning Prompt Optimizer
-- Created: 2026-02-05

BEGIN;

-- =============================================================================
-- EXTENSIONS
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- TYPES
-- =============================================================================

CREATE TYPE trajectory_status AS ENUM ('completed', 'failed', 'timeout', 'partial');
CREATE TYPE prompt_version_status AS ENUM ('candidate', 'approved', 'production', 'retired');
CREATE TYPE prompt_creator AS ENUM ('evolution', 'manual');
CREATE TYPE reviewer_role AS ENUM ('reviewer', 'developer', 'admin');
CREATE TYPE review_status AS ENUM ('pending', 'completed', 'skipped', 'expired');

-- =============================================================================
-- TABLES
-- =============================================================================

-- reviewers
CREATE TABLE reviewers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role reviewer_role NOT NULL DEFAULT 'reviewer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ
);

-- agents
CREATE TABLE agents (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    current_production_version_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- branches
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(255) NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    parent_branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_main BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT unique_agent_branch UNIQUE(agent_id, name)
);

CREATE UNIQUE INDEX idx_branches_single_main ON branches (agent_id) WHERE is_main = TRUE;

-- prompt_versions
CREATE TABLE prompt_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(255) NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    version INTEGER NOT NULL,
    content JSONB NOT NULL,
    parent_ids UUID[] DEFAULT '{}',
    mutation_type VARCHAR(100),
    mutation_details JSONB,
    fitness JSONB DEFAULT '{"winRate": null, "successRate": null, "avgEfficiency": null, "comparisonCount": 0}',
    status prompt_version_status NOT NULL DEFAULT 'candidate',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by prompt_creator NOT NULL DEFAULT 'manual',
    approved_by VARCHAR(255)[] DEFAULT '{}',
    deployed_at TIMESTAMPTZ,
    CONSTRAINT unique_agent_branch_version UNIQUE(agent_id, branch_id, version)
);

-- Add FK for agents.current_production_version_id
ALTER TABLE agents
ADD CONSTRAINT fk_agents_current_version
FOREIGN KEY (current_production_version_id) REFERENCES prompt_versions(id) ON DELETE SET NULL;

-- trajectories
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

-- comparison_feedback
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

-- review_queue
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

-- deployments
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

-- =============================================================================
-- INDEXES
-- =============================================================================

-- trajectories
CREATE INDEX idx_trajectories_agent_id ON trajectories(agent_id);
CREATE INDEX idx_trajectories_prompt_version_id ON trajectories(prompt_version_id);
CREATE INDEX idx_trajectories_task_type ON trajectories(task_type);
CREATE INDEX idx_trajectories_created_at ON trajectories(created_at DESC);
CREATE INDEX idx_trajectories_session_id ON trajectories(session_id);
CREATE INDEX idx_trajectories_status ON trajectories(status);

-- prompt_versions
CREATE INDEX idx_prompt_versions_agent_id ON prompt_versions(agent_id);
CREATE INDEX idx_prompt_versions_branch_id ON prompt_versions(branch_id);
CREATE INDEX idx_prompt_versions_status ON prompt_versions(status);
CREATE INDEX idx_prompt_versions_created_at ON prompt_versions(created_at DESC);

-- comparison_feedback
CREATE INDEX idx_comparison_feedback_reviewer_id ON comparison_feedback(reviewer_id);
CREATE INDEX idx_comparison_feedback_trajectory_a ON comparison_feedback(trajectory_a_id);
CREATE INDEX idx_comparison_feedback_trajectory_b ON comparison_feedback(trajectory_b_id);
CREATE INDEX idx_comparison_feedback_reviewed_at ON comparison_feedback(reviewed_at DESC);

-- review_queue
CREATE INDEX idx_review_queue_reviewer_id ON review_queue(reviewer_id);
CREATE INDEX idx_review_queue_status ON review_queue(status);
CREATE INDEX idx_review_queue_priority ON review_queue(priority DESC);
CREATE INDEX idx_review_queue_pending ON review_queue(reviewer_id, status) WHERE status = 'pending';

-- deployments
CREATE INDEX idx_deployments_prompt_version_id ON deployments(prompt_version_id);
CREATE INDEX idx_deployments_deployed_at ON deployments(deployed_at DESC);

-- branches
CREATE INDEX idx_branches_agent_id ON branches(agent_id);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

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

    SELECT
        COUNT(*) FILTER (WHERE outcome->>'success' = 'true'),
        COUNT(*)
    INTO success_count, total
    FROM trajectories
    WHERE prompt_version_id = p_version_id;

    IF total > 0 THEN
        win_rate := (wins::NUMERIC + ties::NUMERIC * 0.5) / NULLIF(wins + losses + ties, 0);
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

-- Record migration
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version) VALUES ('001_initial_schema');

COMMIT;
