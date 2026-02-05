# Admin Dashboard Documentation

## Overview

The Agent Lightning Admin Dashboard provides comprehensive monitoring and management for the APO (Automatic Prompt Optimization) system. It displays system metrics, reviewer activity, agent performance, and inter-rater reliability metrics.

## Features

### 1. System Metrics (SystemMetrics.tsx)
Real-time overview of system health:
- **Trajectories**: Total collected, today, and this week
- **Reviews**: Total completed, today, and this week
- **Active Agents**: Number and names of agents in production
- **Generations**: Total evolution rounds completed
- **Mutations**: Total prompt variations created
- **Population**: Active prompts per agent

**Auto-refresh**: Every 30 seconds

### 2. Agent Overview (AgentOverview.tsx)
Per-agent summary cards showing:
- Production version number
- Current fitness score with trend indicator (↑ ↓ →)
- Total trajectory count
- Number of active branches
- Last deployment timestamp
- Population size

**Trend Detection**:
- ↑ Green: Fitness improved >5% in last 7 days
- ↓ Red: Fitness declined >5% in last 7 days
- → Gray: Stable (within 5%)

### 3. Reviewer Activity (ReviewerActivity.tsx)
Detailed reviewer statistics with filtering and sorting:

**Metrics per Reviewer**:
- Total review count
- Agreement rate (Cohen's kappa approximation)
- Current streak (consecutive days with reviews)
- Average review time
- Last active timestamp
- Preference distribution (A/B/Tie)

**Filters**:
- All / Admins / Reviewers / Active / Inactive

**Sorting Options**:
- By review count
- By agreement rate
- By streak length

**Auto-refresh**: Every 60 seconds

### 4. Fitness Trends (FitnessTrends.tsx)
Visual charts showing prompt improvement over time:

**Charts**:
1. **Fitness Score** (Area chart)
   - Average fitness score per day
   - Gradient fill for visual impact

2. **Performance Metrics** (Line chart)
   - Win Rate (%)
   - Success Rate (%)
   - Efficiency (%)

**Features**:
- Agent selector (switch between agents)
- Time range selector (24h, 7d, 30d, 90d, all)
- Trend indicator with percentage change
- Responsive design

**Auto-refresh**: Every 60 seconds

### 5. Queue Health (QueueHealth.tsx)
Review queue monitoring and backlog alerts:

**Metrics**:
- Current queue depth
- Average wait time (from creation to first review)
- Daily comparisons average

**Chart**:
- Bar chart of comparisons per day (last 30 days)

**Health Assessment**:
- Queue status (Healthy / Backlogged)
- Processing rate vs. demand
- Estimated time to clear backlog

**Backlog Alert**:
- Triggered when queue depth > 3x daily processing rate
- Shows actionable recommendations

**Auto-refresh**: Every 30 seconds

### 6. Inter-Rater Reliability (InterRaterReliability.tsx)
Agreement metrics and calibration recommendations:

**Overall Metrics**:
- Cohen's Kappa (overall agreement across all reviewers)
- Interpretation (Slight / Fair / Moderate / Substantial / Almost Perfect)

**Pairwise Kappa**:
- Agreement between each pair of reviewers
- Top 10 pairs displayed

**Confusion Matrix**:
- 3x3 matrix showing preference agreement
- Rows: Reviewer 1 preference (A/B/Tie)
- Columns: Reviewer 2 preference (A/B/Tie)
- Diagonal cells (AA, BB, TieTie) highlighted in green (perfect agreement)
- Off-diagonal cells show disagreements

**Calibration Alert**:
- Triggered when overall kappa < 0.6 (below moderate)
- Provides actionable recommendations:
  - Run calibration sessions
  - Clarify evaluation criteria
  - Review disagreement cases
  - Update reviewer guidelines

**Cohen's Kappa Interpretation**:
- < 0: Poor agreement
- 0.0-0.2: Slight agreement
- 0.2-0.4: Fair agreement
- 0.4-0.6: Moderate agreement
- 0.6-0.8: Substantial agreement
- 0.8-1.0: Almost perfect agreement

**Auto-refresh**: Every 5 minutes (expensive calculation)

## Pages

### Main Dashboard (`/admin`)
Combines all widgets in a responsive layout:
- System Metrics (3-column grid)
- Agent Overview (2-3 column grid)
- Queue Health + Inter-Rater Reliability (2-column grid)
- Fitness Trends (full width)
- Reviewer Activity (full width)

**Features**:
- Time range selector (applies to System Metrics and Fitness Trends)
- Auto-refresh toggle
- Export buttons (CSV and JSON)
- Quick links to detail pages

### Reviewer Management (`/admin/reviewers`)
Full-featured reviewer table:
- Search by name or email
- Sortable columns
- Edit reviewer details
- Send reminder emails
- Add new reviewers

### Agent Management (`/admin/agents`)
Agent configuration and monitoring:
- Grid of agent cards
- Summary statistics
- Create new agent
- View agent details
- Navigate to prompts

## API Endpoints

All endpoints are prefixed with `/api/admin/`

### GET `/api/admin/metrics?timeRange={24h|7d|30d|90d|all}`
Returns system-wide metrics.

**Response**:
```typescript
{
  trajectories: { today: number, week: number, total: number }
  reviews: { today: number, week: number, total: number }
  agents: number
  generations: number
  mutations: number
  activeAgents: string[]
  populationSizes: Record<string, number>
}
```

### GET `/api/admin/reviewers`
Returns all reviewer statistics.

**Response**: `ReviewerStats[]`

### GET `/api/admin/reviewers/:id`
Returns individual reviewer stats.

### PUT `/api/admin/reviewers/:id`
Updates reviewer details (name, email, role).

**Body**:
```json
{
  "name": "string",
  "email": "string",
  "role": "admin" | "reviewer"
}
```

### GET `/api/admin/fitness?agentId={name}&timeRange={24h|7d|30d|90d|all}`
Returns fitness trends for an agent.

**Response**: `FitnessTrend[]`

### GET `/api/admin/reliability`
Returns inter-rater reliability metrics.

**Response**:
```typescript
{
  overallKappa: number
  pairwiseKappa: Record<string, Record<string, number>>
  sampleSize: number
  confusionMatrix: {
    AA: number, AB: number, ATie: number,
    BA: number, BB: number, BTie: number,
    TieA: number, TieB: number, TieTie: number
  }
}
```

### GET `/api/admin/queue-health`
Returns review queue health metrics.

**Response**:
```typescript
{
  currentDepth: number
  avgWaitTime: number // seconds
  comparisonsPerDay: number
  backlogAlert: boolean
  trends: Array<{ date: Date, depth: number, comparisons: number }>
}
```

### GET `/api/admin/agents`
Returns agent summaries with performance metrics.

**Response**: `AgentSummary[]`

### POST `/api/admin/agents`
Creates a new agent.

**Body**:
```json
{
  "name": "string",
  "description": "string",
  "basePrompt": "string"
}
```

### GET `/api/admin/export?format={csv|json}`
Exports all admin data.

**Response**: Downloads file

## React Query Hooks

Located in `src/hooks/useAdminMetrics.ts`:

```typescript
// System metrics
useSystemMetrics(timeRange: TimeRange)

// Reviewers
useReviewerStats()
useReviewer(id: string)
useUpdateReviewer()

// Agent performance
useFitnessTrends(agentId: string, timeRange: TimeRange)
useAgentSummaries()

// Quality metrics
useQueueHealth()
useInterRaterReliability()

// Data export
useExportData()
```

All hooks include:
- Automatic refetching at appropriate intervals
- Loading and error states
- Type-safe responses
- Date parsing for timestamp fields

## Metrics Calculations

Located in `src/lib/metrics.ts`:

### System Metrics
- Counts trajectories and reviews with time bucketing (today, week, total)
- Identifies active agents
- Calculates population sizes per agent
- Finds max generation number
- Counts mutations (non-base versions)

### Reviewer Stats
- Aggregates review counts per reviewer
- Calculates agreement rate (approximation of Cohen's kappa)
- Computes streaks (consecutive days with reviews)
- Tracks preference distributions (A/B/Tie)
- Measures average review time

### Fitness Trends
- Daily aggregation of fitness scores
- Calculates success rate, win rate, efficiency
- Tracks generation numbers
- Supports time range filtering

### Cohen's Kappa
- Finds pairs reviewed by both reviewers
- Calculates observed agreement (P_o)
- Calculates expected agreement by chance (P_e)
- Formula: κ = (P_o - P_e) / (1 - P_e)

### Queue Health
- Current pending comparison count
- Average wait time from creation to first review
- Daily comparison rate (last 30 days)
- Backlog alert threshold: queue > 3x daily rate

## Database Schema Requirements

The metrics calculations assume these tables exist:

```sql
-- Core tables
trajectories (id, agent_name, prompt_version_id, created_at, completed_at, status, metadata)
comparison_feedback (id, reviewer_id, trajectory_a_id, trajectory_b_id, preference, reviewed_at, created_at)
reviewers (id, name, email, role, created_at)
prompt_versions (id, agent_name, version_number, parent_version_id, is_active, metadata)
comparison_queue (id, trajectory_a_id, trajectory_b_id, status, created_at)
deployments (id, agent_name, deployed_at)

-- Indexes recommended
CREATE INDEX idx_trajectories_created ON trajectories(created_at);
CREATE INDEX idx_feedback_reviewed ON comparison_feedback(reviewed_at);
CREATE INDEX idx_feedback_reviewer ON comparison_feedback(reviewer_id);
CREATE INDEX idx_prompts_agent ON prompt_versions(agent_name);
```

## Performance Considerations

### Auto-Refresh Intervals
- System Metrics: 30s (cheap queries)
- Queue Health: 30s (cheap queries)
- Reviewer Stats: 60s (moderate complexity)
- Fitness Trends: 60s (moderate complexity)
- Agent Summaries: 60s (moderate complexity)
- Inter-Rater Reliability: 5 minutes (expensive calculation)

### Caching Recommendations
For production deployments:
1. Cache system metrics in Redis (30s TTL)
2. Cache reliability metrics in Redis (5 min TTL)
3. Add database connection pooling
4. Index all date columns used in queries
5. Consider materialized views for fitness trends

### Scalability
- Cohen's kappa calculation is O(n²) in number of reviewers
- Pairwise kappa limited to top 10 pairs to prevent UI overflow
- Fitness trends limited by time range parameter
- Consider background jobs for expensive metrics

## Styling

The dashboard uses a **dark industrial aesthetic**:
- Clean, professional layout
- Muted color palette with accent colors
- Cards with subtle borders
- Trend indicators (green/red/gray)
- Responsive grid layouts
- Skeleton loaders for all components
- Empty states with helpful messages

## Future Enhancements

Potential additions:
1. Real-time websocket updates
2. Alerts and notifications
3. Reviewer leaderboards with rewards
4. A/B test results visualization
5. Cost tracking (API usage per agent)
6. Deployment history timeline
7. Automated calibration scheduling
8. Anomaly detection alerts
9. Custom date range picker
10. PDF report generation

## Troubleshooting

### No data showing
- Check database connection (`DATABASE_URL` in `.env`)
- Verify tables exist and have data
- Check browser console for API errors
- Confirm React Query DevTools shows successful fetches

### Slow performance
- Add database indexes (see schema section)
- Reduce auto-refresh intervals
- Enable Redis caching
- Check database query plans

### Incorrect metrics
- Verify timezone handling (all dates in UTC)
- Check metadata field format in trajectories
- Confirm comparison_queue table exists
- Validate reviewer_id foreign keys

## Development

To modify the dashboard:

1. **Add new metric**: Update `src/lib/metrics.ts`
2. **Add new chart**: Use Recharts components
3. **Add new page**: Create in `src/app/admin/`
4. **Add new API**: Create in `src/app/api/admin/`
5. **Add new hook**: Update `src/hooks/useAdminMetrics.ts`

Always include:
- TypeScript types
- Loading states
- Error handling
- Auto-refresh
- Responsive design
