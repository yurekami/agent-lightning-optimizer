-- Seed data for Agent Lightning Prompt Optimizer
-- For development and testing purposes

BEGIN;

-- =============================================================================
-- REVIEWERS
-- =============================================================================

INSERT INTO reviewers (id, email, name, role) VALUES
    ('11111111-1111-1111-1111-111111111111', 'admin@example.com', 'System Admin', 'admin'),
    ('22222222-2222-2222-2222-222222222222', 'dev@example.com', 'Lead Developer', 'developer'),
    ('33333333-3333-3333-3333-333333333333', 'reviewer1@example.com', 'Alice Reviewer', 'reviewer'),
    ('44444444-4444-4444-4444-444444444444', 'reviewer2@example.com', 'Bob Reviewer', 'reviewer');

-- =============================================================================
-- AGENTS
-- =============================================================================

INSERT INTO agents (id, name, description) VALUES
    ('oh-my-claudecode:executor', 'Executor Agent', 'Executes code changes and implements features'),
    ('oh-my-claudecode:executor-high', 'Executor High Agent', 'Complex multi-file refactoring and architectural changes'),
    ('oh-my-claudecode:architect', 'Architect Agent', 'System design, debugging, and architectural decisions'),
    ('oh-my-claudecode:explore', 'Explore Agent', 'Codebase exploration and search'),
    ('oh-my-claudecode:designer', 'Designer Agent', 'UI/UX implementation and styling'),
    ('oh-my-claudecode:tdd-guide', 'TDD Guide Agent', 'Test-driven development workflow guidance');

-- =============================================================================
-- BRANCHES
-- =============================================================================

-- Main branches for each agent
INSERT INTO branches (id, agent_id, name, is_main) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'oh-my-claudecode:executor', 'main', TRUE),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'oh-my-claudecode:executor-high', 'main', TRUE),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'oh-my-claudecode:architect', 'main', TRUE),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'oh-my-claudecode:explore', 'main', TRUE),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'oh-my-claudecode:designer', 'main', TRUE),
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'oh-my-claudecode:tdd-guide', 'main', TRUE);

-- Experimental branch for executor
INSERT INTO branches (id, agent_id, name, parent_branch_id, is_main) VALUES
    ('11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'oh-my-claudecode:executor', 'experiment/concise-prompts', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', FALSE);

-- =============================================================================
-- PROMPT VERSIONS
-- =============================================================================

-- Executor v1 (production)
INSERT INTO prompt_versions (id, agent_id, branch_id, version, content, status, created_by, deployed_at) VALUES
    ('a1111111-1111-1111-1111-111111111111', 'oh-my-claudecode:executor', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1,
    '{
        "systemPrompt": "You are an executor agent. Your job is to implement code changes efficiently and correctly. Follow best practices and write clean, maintainable code.",
        "toolDescriptions": {
            "Read": "Read file contents",
            "Write": "Write file contents",
            "Edit": "Edit file with search/replace"
        },
        "subagentPrompts": {}
    }'::jsonb,
    'production', 'manual', NOW() - INTERVAL '30 days');

-- Executor v2 (approved, candidate for production)
INSERT INTO prompt_versions (id, agent_id, branch_id, version, content, parent_ids, mutation_type, mutation_details, status, created_by, fitness) VALUES
    ('a2222222-2222-2222-2222-222222222222', 'oh-my-claudecode:executor', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2,
    '{
        "systemPrompt": "You are an executor agent specialized in implementing code changes. Execute tasks efficiently with minimal token usage. Always verify changes work before completing. Follow the principle: read before edit, verify after change.",
        "toolDescriptions": {
            "Read": "Read file contents - always read before editing",
            "Write": "Write complete file contents - use for new files",
            "Edit": "Edit file with search/replace - preferred for modifications"
        },
        "subagentPrompts": {}
    }'::jsonb,
    ARRAY['a1111111-1111-1111-1111-111111111111']::UUID[],
    'rephrase',
    '{"focus": "clarity and efficiency", "changes": ["Added verification principle", "Clarified tool usage"]}'::jsonb,
    'approved', 'evolution',
    '{"winRate": 0.65, "successRate": 0.82, "avgEfficiency": 0.75, "comparisonCount": 20}'::jsonb);

-- Executor v3 (candidate, experimental branch)
INSERT INTO prompt_versions (id, agent_id, branch_id, version, content, parent_ids, mutation_type, mutation_details, status, created_by, fitness) VALUES
    ('a3333333-3333-3333-3333-333333333333', 'oh-my-claudecode:executor', '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1,
    '{
        "systemPrompt": "Executor agent. Implement changes. Verify. Be concise.",
        "toolDescriptions": {
            "Read": "Read file",
            "Write": "Write file",
            "Edit": "Edit file"
        },
        "subagentPrompts": {}
    }'::jsonb,
    ARRAY['a2222222-2222-2222-2222-222222222222']::UUID[],
    'compression',
    '{"focus": "token reduction", "originalTokens": 150, "compressedTokens": 45}'::jsonb,
    'candidate', 'evolution',
    '{"winRate": 0.55, "successRate": 0.78, "avgEfficiency": 0.90, "comparisonCount": 10}'::jsonb);

-- Architect v1 (production)
INSERT INTO prompt_versions (id, agent_id, branch_id, version, content, status, created_by, deployed_at) VALUES
    ('c1111111-1111-1111-1111-111111111111', 'oh-my-claudecode:architect', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 1,
    '{
        "systemPrompt": "You are an architect agent. Analyze systems deeply, identify patterns, debug complex issues, and provide architectural guidance. Think through problems systematically before suggesting solutions.",
        "toolDescriptions": {
            "Read": "Read file contents for analysis",
            "Grep": "Search codebase for patterns",
            "Glob": "Find files by pattern"
        },
        "subagentPrompts": {}
    }'::jsonb,
    'production', 'manual', NOW() - INTERVAL '25 days');

-- Update agents with current production versions
UPDATE agents SET current_production_version_id = 'a1111111-1111-1111-1111-111111111111' WHERE id = 'oh-my-claudecode:executor';
UPDATE agents SET current_production_version_id = 'c1111111-1111-1111-1111-111111111111' WHERE id = 'oh-my-claudecode:architect';

-- =============================================================================
-- TRAJECTORIES
-- =============================================================================

-- Successful executor trajectory with v1
INSERT INTO trajectories (id, session_id, agent_id, prompt_version_id, task_type, started_at, completed_at, status, steps, outcome, metrics) VALUES
    ('t1111111-1111-1111-1111-111111111111', 'session-001', 'oh-my-claudecode:executor', 'a1111111-1111-1111-1111-111111111111',
    'code_change', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '2 minutes', 'completed',
    '[
        {"type": "thinking", "content": "Need to read the file first", "tokens": 50, "durationMs": 500},
        {"type": "tool_call", "tool": "Read", "input": {"file_path": "/src/utils.ts"}, "output": "file contents...", "tokens": 200, "durationMs": 1000},
        {"type": "thinking", "content": "Will add validation function", "tokens": 100, "durationMs": 800},
        {"type": "tool_call", "tool": "Edit", "input": {"file_path": "/src/utils.ts", "old_string": "...", "new_string": "..."}, "output": "success", "tokens": 150, "durationMs": 500}
    ]'::jsonb,
    '{"success": true, "artifacts": {"files_modified": ["/src/utils.ts"]}}'::jsonb,
    '{"totalTokens": 500, "totalSteps": 4, "durationMs": 120000}'::jsonb);

-- Successful executor trajectory with v2
INSERT INTO trajectories (id, session_id, agent_id, prompt_version_id, task_type, started_at, completed_at, status, steps, outcome, metrics) VALUES
    ('t2222222-2222-2222-2222-222222222222', 'session-002', 'oh-my-claudecode:executor', 'a2222222-2222-2222-2222-222222222222',
    'code_change', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '90 seconds', 'completed',
    '[
        {"type": "tool_call", "tool": "Read", "input": {"file_path": "/src/api.ts"}, "output": "file contents...", "tokens": 180, "durationMs": 800},
        {"type": "thinking", "content": "Adding error handling", "tokens": 80, "durationMs": 600},
        {"type": "tool_call", "tool": "Edit", "input": {"file_path": "/src/api.ts", "old_string": "...", "new_string": "..."}, "output": "success", "tokens": 120, "durationMs": 400}
    ]'::jsonb,
    '{"success": true, "artifacts": {"files_modified": ["/src/api.ts"]}}'::jsonb,
    '{"totalTokens": 380, "totalSteps": 3, "durationMs": 90000}'::jsonb);

-- Failed trajectory with v1
INSERT INTO trajectories (id, session_id, agent_id, prompt_version_id, task_type, started_at, completed_at, status, steps, outcome, metrics) VALUES
    ('t3333333-3333-3333-3333-333333333333', 'session-003', 'oh-my-claudecode:executor', 'a1111111-1111-1111-1111-111111111111',
    'code_change', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days' + INTERVAL '3 minutes', 'failed',
    '[
        {"type": "tool_call", "tool": "Read", "input": {"file_path": "/src/missing.ts"}, "output": "Error: File not found", "tokens": 100, "durationMs": 500},
        {"type": "thinking", "content": "File does not exist, need to ask user", "tokens": 60, "durationMs": 400}
    ]'::jsonb,
    '{"success": false, "error": "Target file not found"}'::jsonb,
    '{"totalTokens": 160, "totalSteps": 2, "durationMs": 180000}'::jsonb);

-- Another successful v2 trajectory for comparison
INSERT INTO trajectories (id, session_id, agent_id, prompt_version_id, task_type, started_at, completed_at, status, steps, outcome, metrics) VALUES
    ('t4444444-4444-4444-4444-444444444444', 'session-004', 'oh-my-claudecode:executor', 'a2222222-2222-2222-2222-222222222222',
    'refactoring', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '2 minutes', 'completed',
    '[
        {"type": "tool_call", "tool": "Glob", "input": {"pattern": "**/*.ts"}, "output": ["src/a.ts", "src/b.ts"], "tokens": 100, "durationMs": 300},
        {"type": "tool_call", "tool": "Read", "input": {"file_path": "/src/a.ts"}, "output": "...", "tokens": 200, "durationMs": 600},
        {"type": "tool_call", "tool": "Read", "input": {"file_path": "/src/b.ts"}, "output": "...", "tokens": 200, "durationMs": 600},
        {"type": "thinking", "content": "Extracting common logic", "tokens": 120, "durationMs": 800},
        {"type": "tool_call", "tool": "Write", "input": {"file_path": "/src/common.ts", "content": "..."}, "output": "success", "tokens": 150, "durationMs": 400},
        {"type": "tool_call", "tool": "Edit", "input": {"file_path": "/src/a.ts"}, "output": "success", "tokens": 100, "durationMs": 300},
        {"type": "tool_call", "tool": "Edit", "input": {"file_path": "/src/b.ts"}, "output": "success", "tokens": 100, "durationMs": 300}
    ]'::jsonb,
    '{"success": true, "artifacts": {"files_modified": ["/src/a.ts", "/src/b.ts"], "files_created": ["/src/common.ts"]}}'::jsonb,
    '{"totalTokens": 970, "totalSteps": 7, "durationMs": 120000}'::jsonb);

-- =============================================================================
-- COMPARISON FEEDBACK
-- =============================================================================

-- Comparison: v1 vs v2 (v2 wins - more efficient)
INSERT INTO comparison_feedback (id, trajectory_a_id, trajectory_b_id, reviewer_id, ratings, comment) VALUES
    ('f1111111-1111-1111-1111-111111111111', 't1111111-1111-1111-1111-111111111111', 't2222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    '{"aSuccess": 5, "bSuccess": 5, "aEfficiency": 3, "bEfficiency": 5, "preference": "b"}'::jsonb,
    'Both completed successfully but B used fewer tokens and was faster');

-- Comparison: v1 failed vs v2 success (v2 wins)
INSERT INTO comparison_feedback (id, trajectory_a_id, trajectory_b_id, reviewer_id, ratings, comment) VALUES
    ('f2222222-2222-2222-2222-222222222222', 't3333333-3333-3333-3333-333333333333', 't4444444-4444-4444-4444-444444444444',
    '44444444-4444-4444-4444-444444444444',
    '{"aSuccess": 1, "bSuccess": 5, "aEfficiency": 2, "bEfficiency": 4, "preference": "b"}'::jsonb,
    'A failed while B completed a complex refactoring successfully');

-- Skipped comparison
INSERT INTO comparison_feedback (id, trajectory_a_id, trajectory_b_id, reviewer_id, ratings, skipped, skip_reason) VALUES
    ('f3333333-3333-3333-3333-333333333333', 't1111111-1111-1111-1111-111111111111', 't4444444-4444-4444-4444-444444444444',
    '33333333-3333-3333-3333-333333333333',
    '{}'::jsonb,
    TRUE, 'Tasks are too different to compare meaningfully');

-- =============================================================================
-- REVIEW QUEUE
-- =============================================================================

-- Pending review
INSERT INTO review_queue (id, reviewer_id, trajectory_a_id, trajectory_b_id, status, priority) VALUES
    ('q1111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
    't2222222-2222-2222-2222-222222222222', 't4444444-4444-4444-4444-444444444444',
    'pending', 5);

-- Unassigned pending (for any reviewer)
INSERT INTO review_queue (id, reviewer_id, trajectory_a_id, trajectory_b_id, status, priority) VALUES
    ('q2222222-2222-2222-2222-222222222222', NULL,
    't1111111-1111-1111-1111-111111111111', 't2222222-2222-2222-2222-222222222222',
    'pending', 3);

-- =============================================================================
-- DEPLOYMENTS
-- =============================================================================

-- Initial deployment of executor v1
INSERT INTO deployments (id, prompt_version_id, deployed_by, deployed_at, metrics_before, metrics_after) VALUES
    ('d1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    NOW() - INTERVAL '30 days',
    NULL,
    '{"successRate": 0.75, "avgTokens": 450, "avgDurationMs": 100000}'::jsonb);

-- Initial deployment of architect v1
INSERT INTO deployments (id, prompt_version_id, deployed_by, deployed_at, metrics_before, metrics_after) VALUES
    ('d2222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    NOW() - INTERVAL '25 days',
    NULL,
    '{"successRate": 0.85, "avgTokens": 800, "avgDurationMs": 150000}'::jsonb);

COMMIT;

-- Verify seed data
SELECT 'Reviewers: ' || COUNT(*) FROM reviewers;
SELECT 'Agents: ' || COUNT(*) FROM agents;
SELECT 'Branches: ' || COUNT(*) FROM branches;
SELECT 'Prompt Versions: ' || COUNT(*) FROM prompt_versions;
SELECT 'Trajectories: ' || COUNT(*) FROM trajectories;
SELECT 'Comparison Feedback: ' || COUNT(*) FROM comparison_feedback;
SELECT 'Review Queue: ' || COUNT(*) FROM review_queue;
SELECT 'Deployments: ' || COUNT(*) FROM deployments;
