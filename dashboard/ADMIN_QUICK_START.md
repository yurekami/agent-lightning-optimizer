# Admin Dashboard - Quick Start Guide

## Installation

```bash
cd dashboard
npm install
```

Recharts has been added to `package.json` and installed.

## Access

Navigate to: **http://localhost:3000/admin**

## Main Dashboard Features

### Time Range Selector
Located at the top of the dashboard. Controls:
- System Metrics
- Fitness Trends

Options: `24h | 7d | 30d | 90d | All`

### Auto-Refresh Toggle
Click "Auto-refresh" button to enable/disable automatic updates.

When enabled:
- System Metrics: Updates every 30s
- Reviewer Activity: Updates every 60s
- Fitness Trends: Updates every 60s
- Queue Health: Updates every 30s
- Inter-Rater Reliability: Updates every 5 minutes

### Export Data
- **Export CSV**: Download system data as CSV
- **Export JSON**: Download system data as JSON

Includes:
- System metrics
- All reviewer stats
- All agent summaries

## Widget Descriptions

### 1. System Metrics (Top Row)
Six cards showing:
1. **Trajectories**: Total runs with today/week counts
2. **Reviews**: Total comparisons with today/week counts
3. **Active Agents**: Number of agents in production
4. **Generations**: Total evolution rounds
5. **Mutations**: Total prompt variations
6. **Population**: Total active prompts across all agents

### 2. Agent Overview
Grid of agent cards, each showing:
- Agent name
- Production version
- Fitness score (with trend: ↑ ↓ →)
- Trajectory count
- Active branches
- Last deployment

**Actions**:
- View Prompts: Navigate to prompts page filtered by agent
- Settings: View agent details

### 3. Queue Health & Inter-Rater Reliability (Two Columns)

#### Queue Health
- Current queue depth
- Average wait time
- Daily comparisons chart
- Health assessment
- Backlog alerts

**Backlog Alert** triggers when queue depth > 3x daily processing rate.

#### Inter-Rater Reliability
- Overall Cohen's kappa
- Pairwise agreement
- Confusion matrix (3x3 grid)
- Calibration recommendations

**Kappa Interpretation**:
- 0.8-1.0: Almost Perfect ✅
- 0.6-0.8: Substantial ✅
- 0.4-0.6: Moderate ⚠️
- 0.2-0.4: Fair ⚠️
- < 0.2: Slight ❌

### 4. Fitness Trends (Full Width)
Two charts:
1. **Fitness Score** (Area chart): Average fitness per day
2. **Performance Metrics** (Line chart): Win rate, success rate, efficiency

**Agent Selector**: Switch between agents
**Trend Indicator**: Shows +/- percentage change

### 5. Reviewer Activity (Full Width)
Table of all reviewers with:
- Name, email, role
- Review count
- Agreement rate
- Streak (consecutive days)
- Preferences (A/B/Tie)
- Last active

**Filters**:
- All / Admins / Reviewers / Active / Inactive

**Sort by**:
- Reviews
- Agreement
- Streak

## Detail Pages

### Reviewer Management (`/admin/reviewers`)
Full table with:
- Search by name/email
- Sortable columns
- Edit reviewer
- Send reminder email
- Add new reviewer

### Agent Management (`/admin/agents`)
Grid of agent cards with:
- Summary statistics
- Create new agent
- View prompts
- Configure agent settings

## Understanding Metrics

### Fitness Score
Composite score from:
- Success rate (task completion)
- Win rate (pairwise comparisons)
- Efficiency (steps taken)

Higher is better. Range: 0.0 to 1.0

### Agreement Rate
Cohen's kappa between this reviewer and all others.
- 1.0 = Perfect agreement
- 0.5 = Moderate agreement
- 0.0 = No agreement (random)

### Streak
Number of consecutive days with at least one review.
🔥 Fire icon shown when streak > 0.

### Backlog Alert
Indicates review queue is growing faster than it's being cleared.

**Recommended Actions**:
1. Send reminder to inactive reviewers
2. Add more reviewers
3. Prioritize critical comparisons
4. Temporarily pause trajectory collection

## Common Tasks

### Check System Health
1. Go to `/admin`
2. Look at System Metrics cards
3. Check Queue Health for backlog alerts
4. Review Inter-Rater Reliability for calibration needs

### Monitor Agent Performance
1. Go to `/admin`
2. Scroll to Agent Overview
3. Look for trend indicators (↑ ↓ →)
4. Click "View Prompts" to see versions

### Analyze Fitness Trends
1. Go to `/admin`
2. Scroll to Fitness Trends
3. Select agent from dropdown
4. Choose time range (24h to All)
5. Examine charts for improvements

### Manage Reviewers
1. Go to `/admin/reviewers`
2. Use search bar to find specific reviewer
3. Sort by review count to find top contributors
4. Check agreement rate for calibration needs
5. Click edit to update reviewer details

### Create New Agent
1. Go to `/admin/agents`
2. Click "Create Agent"
3. Enter agent name, description, base prompt
4. Submit
5. Agent appears in grid

### Export Data
1. Go to `/admin`
2. Click "Export CSV" or "Export JSON"
3. File downloads automatically
4. Filename format: `admin-export-{timestamp}.{format}`

## Alerts & Recommendations

### Backlog Alert (Queue Health)
**Trigger**: Queue depth > 3x daily processing rate

**Actions**:
- Send reminders to inactive reviewers
- Add more reviewers
- Pause new trajectory collection
- Prioritize critical comparisons

### Calibration Alert (Inter-Rater Reliability)
**Trigger**: Overall kappa < 0.6

**Actions**:
- Run calibration sessions
- Clarify evaluation criteria
- Review disagreement cases together
- Update reviewer guidelines

### Declining Fitness (Agent Overview)
**Trigger**: Fitness score down >5% in last 7 days

**Actions**:
- Review recent prompt changes
- Check for data quality issues
- Analyze failing trajectories
- Rollback to previous version if needed

## Troubleshooting

### No data showing
**Check**:
1. Database connection (DATABASE_URL in .env)
2. Tables exist and have data
3. Browser console for API errors
4. React Query DevTools

### Slow loading
**Solutions**:
1. Add database indexes (see ADMIN_DASHBOARD.md)
2. Reduce auto-refresh intervals
3. Enable Redis caching
4. Check database query plans

### Charts not rendering
**Check**:
1. Recharts is installed (`npm install recharts`)
2. Browser supports SVG
3. No JavaScript errors in console
4. Data is in correct format

### Export fails
**Check**:
1. API endpoint is accessible
2. No CORS errors
3. Browser allows downloads
4. Sufficient data exists

## Keyboard Shortcuts

*Coming soon in future version*

## Mobile Support

Dashboard is fully responsive:
- Cards stack vertically on mobile
- Tables scroll horizontally
- Charts resize automatically
- Touch-friendly buttons

## Browser Support

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance Tips

1. **Use shorter time ranges** for faster loading
2. **Disable auto-refresh** when not actively monitoring
3. **Filter reviewers** to reduce table size
4. **Close unused tabs** to reduce API calls

## Next Steps

After familiarizing yourself with the dashboard:
1. Set up database indexes (see ADMIN_DASHBOARD.md)
2. Configure auto-refresh intervals
3. Add more reviewers
4. Create calibration schedule
5. Set up alerts/notifications (future feature)

## Need Help?

See full documentation in `ADMIN_DASHBOARD.md`
