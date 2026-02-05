# Admin Dashboard Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                       ADMIN DASHBOARD                            │
│                    http://localhost:3000/admin                   │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                         UI COMPONENTS                            │
├─────────────────────────────────────────────────────────────────┤
│  SystemMetrics  │  AgentOverview  │  ReviewerActivity          │
│  FitnessTrends  │  QueueHealth    │  InterRaterReliability     │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      REACT QUERY HOOKS                           │
├─────────────────────────────────────────────────────────────────┤
│  useSystemMetrics()      │  useReviewerStats()                  │
│  useFitnessTrends()      │  useQueueHealth()                    │
│  useInterRaterReliability()  │  useAgentSummaries()             │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API ROUTES                               │
├─────────────────────────────────────────────────────────────────┤
│  GET /api/admin/metrics          │  GET /api/admin/reviewers    │
│  GET /api/admin/fitness          │  GET /api/admin/reliability  │
│  GET /api/admin/queue-health     │  GET /api/admin/agents       │
│  GET /api/admin/export           │  POST /api/admin/agents      │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      METRICS LIBRARY                             │
├─────────────────────────────────────────────────────────────────┤
│  calculateSystemMetrics()        │  calculateReviewerStats()    │
│  calculateFitnessTrends()        │  calculateCohenKappa()       │
│  calculateOverallReliability()   │  calculateQueueHealth()      │
│  calculateAgentSummaries()       │                              │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                       POSTGRESQL DATABASE                        │
├─────────────────────────────────────────────────────────────────┤
│  trajectories         │  comparison_feedback                     │
│  reviewers           │  prompt_versions                         │
│  comparison_queue    │  deployments                             │
└─────────────────────────────────────────────────────────────────┘
```

## Component Hierarchy

```
AdminPage (/admin)
├── SystemMetrics
│   ├── Card (Trajectories)
│   ├── Card (Reviews)
│   ├── Card (Active Agents)
│   ├── Card (Generations)
│   ├── Card (Mutations)
│   └── Card (Population)
│
├── AgentOverview
│   └── Card[] (per agent)
│       ├── Fitness Score + Trend
│       ├── Trajectory Count
│       ├── Active Branches
│       └── Last Deployment
│
├── QueueHealth
│   ├── Metrics Cards
│   ├── Bar Chart (Recharts)
│   └── Health Assessment
│
├── InterRaterReliability
│   ├── Overall Kappa
│   ├── Pairwise Matrix
│   ├── Confusion Matrix
│   └── Calibration Alert
│
├── FitnessTrends
│   ├── Agent Selector
│   ├── Area Chart (Fitness)
│   └── Line Chart (Metrics)
│
└── ReviewerActivity
    ├── Filters & Sort
    └── Reviewer Cards[]
        ├── Name & Email
        ├── Review Count
        ├── Agreement Rate
        ├── Streak
        └── Preferences
```

## Data Flow

### 1. System Metrics Flow
```
User visits /admin
    ↓
SystemMetrics component renders
    ↓
useSystemMetrics('7d') hook called
    ↓
React Query fetches GET /api/admin/metrics?timeRange=7d
    ↓
API calls calculateSystemMetrics('7d')
    ↓
SQL queries executed on PostgreSQL
    ↓
Data aggregated and returned
    ↓
React Query caches result (30s)
    ↓
Component displays metrics
    ↓
Auto-refresh after 30s
```

### 2. Fitness Trends Flow
```
User selects agent "executor"
    ↓
useFitnessTrends('executor', '30d') called
    ↓
GET /api/admin/fitness?agentId=executor&timeRange=30d
    ↓
calculateFitnessTrends('executor', '30d')
    ↓
Daily aggregation SQL with AVG(fitness_score)
    ↓
Date parsing and formatting
    ↓
Recharts renders Area + Line charts
```

### 3. Cohen's Kappa Calculation Flow
```
Inter-Rater Reliability component
    ↓
useInterRaterReliability() hook
    ↓
GET /api/admin/reliability
    ↓
calculateOverallReliability()
    ↓
For each reviewer pair:
    ├── Find shared reviews
    ├── Calculate P_observed (% agreement)
    ├── Calculate P_expected (chance agreement)
    └── κ = (P_o - P_e) / (1 - P_e)
    ↓
Aggregate all pairwise kappas
    ↓
Build confusion matrix
    ↓
Return metrics
    ↓
Display with interpretation
```

## File Structure

```
dashboard/
├── src/
│   ├── app/
│   │   ├── admin/
│   │   │   ├── page.tsx              ← Main dashboard
│   │   │   ├── reviewers/
│   │   │   │   └── page.tsx          ← Reviewer management
│   │   │   └── agents/
│   │   │       └── page.tsx          ← Agent management
│   │   └── api/
│   │       └── admin/
│   │           ├── route.ts          ← Base endpoint
│   │           ├── metrics/
│   │           │   └── route.ts
│   │           ├── reviewers/
│   │           │   ├── route.ts
│   │           │   └── [id]/route.ts
│   │           ├── fitness/
│   │           │   └── route.ts
│   │           ├── reliability/
│   │           │   └── route.ts
│   │           ├── queue-health/
│   │           │   └── route.ts
│   │           ├── agents/
│   │           │   └── route.ts
│   │           └── export/
│   │               └── route.ts
│   ├── components/
│   │   └── admin/
│   │       ├── SystemMetrics.tsx
│   │       ├── ReviewerActivity.tsx
│   │       ├── FitnessTrends.tsx
│   │       ├── InterRaterReliability.tsx
│   │       ├── QueueHealth.tsx
│   │       ├── AgentOverview.tsx
│   │       └── index.ts
│   ├── hooks/
│   │   └── useAdminMetrics.ts
│   ├── lib/
│   │   ├── db.ts
│   │   └── metrics.ts                ← Core calculations
│   └── types/
│       └── index.ts                  ← TypeScript types
├── ADMIN_DASHBOARD.md                ← Full documentation
├── ADMIN_QUICK_START.md              ← Quick reference
├── ADMIN_FILES_SUMMARY.md            ← File listing
└── ADMIN_ARCHITECTURE.md             ← This file
```

## Technology Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
├─────────────────────────────────────────────────────────────────┤
│  Framework:      Next.js 14 (App Router)                        │
│  UI Library:     React 18                                       │
│  Styling:        Tailwind CSS                                   │
│  State:          React Query (TanStack Query)                   │
│  Charts:         Recharts 2.10                                  │
│  Icons:          Lucide React                                   │
│  Types:          TypeScript 5.3                                 │
│  Date Utils:     date-fns 4.1                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                  │
├─────────────────────────────────────────────────────────────────┤
│  Runtime:        Node.js                                        │
│  Database:       PostgreSQL (via postgres.js)                   │
│  API:            Next.js API Routes                             │
│  Validation:     Zod                                            │
└─────────────────────────────────────────────────────────────────┘
```

## Key Metrics Calculations

### System Metrics
```sql
-- Trajectories today
SELECT COUNT(*) FROM trajectories
WHERE created_at >= NOW() - INTERVAL '1 day'

-- Reviews this week
SELECT COUNT(*) FROM comparison_feedback
WHERE reviewed_at >= NOW() - INTERVAL '7 days'

-- Active agents
SELECT DISTINCT agent_name FROM prompt_versions
WHERE is_active = true

-- Population per agent
SELECT agent_name, COUNT(*) FROM prompt_versions
WHERE is_active = true
GROUP BY agent_name
```

### Reviewer Agreement (Cohen's Kappa)
```javascript
// For each reviewer pair (A, B):
// 1. Find shared reviews
const shared = reviews.filter(r =>
  reviewedByBoth(r, reviewerA, reviewerB)
)

// 2. Calculate observed agreement
const agreements = shared.filter(r =>
  r.preferenceA === r.preferenceB
).length
const P_observed = agreements / shared.length

// 3. Calculate expected agreement
const countsA = countPreferences(reviewerA)
const countsB = countPreferences(reviewerB)
const P_expected = (
  countsA.A * countsB.A +
  countsA.B * countsB.B +
  countsA.tie * countsB.tie
) / (n * n)

// 4. Cohen's Kappa
const kappa = (P_observed - P_expected) / (1 - P_expected)
```

### Fitness Trends
```sql
-- Daily fitness aggregation
SELECT
  DATE(completed_at) as date,
  AVG((metadata->>'fitness_score')::float) as avg_fitness,
  AVG(CASE WHEN metadata->>'outcome' = 'success' THEN 1.0 ELSE 0.0 END) as success_rate,
  AVG((metadata->>'efficiency')::float) as avg_efficiency
FROM trajectories
WHERE agent_name = 'executor'
  AND completed_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(completed_at)
ORDER BY date ASC
```

### Queue Health
```sql
-- Current queue depth
SELECT COUNT(*) FROM comparison_queue
WHERE status = 'pending'

-- Average wait time
SELECT AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at)))
FROM comparison_queue cq
JOIN comparison_feedback cf
  ON cq.trajectory_a_id = cf.trajectory_a_id
WHERE cq.created_at >= NOW() - INTERVAL '7 days'

-- Daily comparisons
SELECT DATE(reviewed_at), COUNT(*)
FROM comparison_feedback
WHERE reviewed_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(reviewed_at)
```

## Caching Strategy

### React Query Cache
```javascript
// System Metrics: 30s stale time
queryClient.setQueryData(['admin', 'metrics', '7d'], data, {
  staleTime: 30000,
  cacheTime: 300000,
})

// Reliability: 5min stale time (expensive)
queryClient.setQueryData(['admin', 'reliability'], data, {
  staleTime: 300000,
  cacheTime: 600000,
})
```

### Recommended Server Cache (Redis)
```javascript
// Cache system metrics
const cacheKey = `admin:metrics:${timeRange}`
const cached = await redis.get(cacheKey)
if (cached) return JSON.parse(cached)

const metrics = await calculateSystemMetrics(timeRange)
await redis.setex(cacheKey, 30, JSON.stringify(metrics))
return metrics
```

## Performance Optimization

### Database Indexes
```sql
-- Critical indexes for admin dashboard
CREATE INDEX idx_trajectories_created ON trajectories(created_at);
CREATE INDEX idx_trajectories_agent ON trajectories(agent_name);
CREATE INDEX idx_feedback_reviewed ON comparison_feedback(reviewed_at);
CREATE INDEX idx_feedback_reviewer ON comparison_feedback(reviewer_id);
CREATE INDEX idx_prompts_agent_active ON prompt_versions(agent_name, is_active);
CREATE INDEX idx_queue_status ON comparison_queue(status);
```

### Query Optimization
1. Use date range filtering to limit rows scanned
2. Aggregate at database level (AVG, COUNT)
3. Avoid N+1 queries (use JOINs)
4. Limit pairwise kappa to top 10 pairs
5. Use EXPLAIN ANALYZE for slow queries

### Frontend Optimization
1. Skeleton loaders prevent layout shift
2. React Query deduplicates concurrent requests
3. Charts use memoization (React.memo)
4. Conditional auto-refresh (only when tab active)
5. Virtualization for large tables (future)

## Error Handling

### API Level
```typescript
try {
  const metrics = await calculateSystemMetrics(timeRange)
  return NextResponse.json(metrics)
} catch (error) {
  console.error('Metrics error:', error)
  return NextResponse.json(
    { error: 'Failed to fetch metrics' },
    { status: 500 }
  )
}
```

### Component Level
```typescript
const { data, isLoading, error } = useSystemMetrics('7d')

if (isLoading) return <SkeletonLoader />
if (error) return <ErrorState />
if (!data) return <EmptyState />

return <Metrics data={data} />
```

## Security Considerations

1. **Authentication**: Add middleware to protect `/admin/*` routes
2. **Authorization**: Verify user has admin role
3. **Rate Limiting**: Prevent API abuse
4. **SQL Injection**: Use parameterized queries (postgres.js handles this)
5. **CSRF Protection**: Use Next.js built-in CSRF tokens
6. **XSS Prevention**: React auto-escapes strings

## Future Enhancements

### Phase 2
- WebSocket real-time updates
- Alerts & notifications
- Email digests
- PDF report generation
- Custom dashboards per user

### Phase 3
- Anomaly detection (ML-based)
- Predictive analytics
- Cost tracking & budgeting
- A/B test analysis
- Multi-tenant support

### Phase 4
- Mobile app
- GraphQL API
- Advanced filters & queries
- Data retention policies
- Automated calibration scheduling

## Deployment Checklist

- [ ] Set DATABASE_URL environment variable
- [ ] Run database migrations
- [ ] Create indexes (see Performance section)
- [ ] Set up Redis cache (optional)
- [ ] Configure CORS for API routes
- [ ] Add authentication middleware
- [ ] Set up monitoring (Sentry, etc.)
- [ ] Configure auto-refresh intervals
- [ ] Test on production database subset
- [ ] Set up backups

## Monitoring

### Metrics to Track
- API response times
- Database query duration
- Cache hit rates
- Error rates
- User sessions
- Most viewed widgets

### Alerts
- API errors > 5% of requests
- Database queries > 1s
- Queue depth > 1000
- Kappa drops below 0.4
- No reviews in 24h

## Support

For issues or questions:
1. Check browser console for errors
2. Verify database connection
3. Review API logs
4. Test with smaller time ranges
5. Clear browser cache & cookies
6. Check React Query DevTools
