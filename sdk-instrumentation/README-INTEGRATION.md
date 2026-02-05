# SDK Instrumentation - Integration with Agent Lightning

This document explains how the SDK instrumentation package integrates with the Agent Lightning Optimizer system.

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Lightning System                    │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Agent      │    │  Collector   │    │  Optimizer   │
│   (SDK)      │───>│   (API)      │───>│    (APO)     │
│ + instrument │    │              │    │              │
└──────────────┘    └──────────────┘    └──────────────┘
      │                    │                    │
      │ trajectories       │ stored data        │ training
      ▼                    ▼                    ▼
  Automatic          PostgreSQL           Optimized
  Capture            Database             Prompts
```

## Component Interaction

### 1. Agent Application (with SDK Instrumentation)

**Location**: Your application
**Technology**: Claude Agent SDK + @agent-lightning/instrumentation
**Role**: Executes tasks and captures trajectories

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';
import { instrument } from '@agent-lightning/instrumentation';

const lightning = instrument({
  collectorUrl: 'http://localhost:4000',
  apiKey: process.env.LIGHTNING_API_KEY,
  agentId: 'my-agent'
});

for await (const message of query({
  prompt: "Your task",
  options: {
    hooks: lightning.hooks  // Captures all tool uses
  }
})) {
  console.log(message);
}
```

**Captures**:
- Tool uses (Read, Edit, Bash, etc.)
- Tool inputs and outputs
- Timestamps
- Success/failure outcomes

### 2. Collector Service

**Location**: `agent-lightning-optimizer/collector/`
**Technology**: Express.js + PostgreSQL
**Role**: Receives and stores trajectory data

**Endpoints Used by Instrumentation**:
```
POST /api/trajectories/start
  Body: { agentId, taskType, startTime }
  Returns: { trajectoryId }

POST /api/trajectories/{id}/steps/batch
  Body: { steps: [...] }
  Returns: { success: true }

POST /api/trajectories/{id}/complete
  Body: { success, result, error, totalSteps, duration }
  Returns: { success: true }
```

**Storage**:
- PostgreSQL database
- `trajectories` table: Session metadata
- `trajectory_steps` table: Individual steps

### 3. Optimizer Service

**Location**: `agent-lightning-optimizer/optimizer/`
**Technology**: Python + PyTorch
**Role**: Runs APO training on collected trajectories

**Workflow**:
1. Reads trajectories from database
2. Extracts (prompt, actions, outcome) tuples
3. Runs APO training to optimize prompts
4. Returns improved prompts

### 4. Dashboard (Optional)

**Location**: `agent-lightning-optimizer/dashboard/`
**Technology**: React + Vite
**Role**: Visualize trajectories and results

## Data Flow

### Complete Flow from Agent to Optimized Prompt

```
1. Agent executes task with instrumentation
   ↓
2. Instrumentation captures each step
   ↓
3. Steps buffered in memory (batch of 10)
   ↓
4. Batch sent to Collector API
   ↓
5. Collector stores in PostgreSQL
   ↓
6. Optimizer reads trajectories
   ↓
7. APO training generates improved prompts
   ↓
8. Developer updates agent with new prompts
   ↓
9. Agent performs better on similar tasks
```

### Detailed Step Flow

```
Agent Action             Instrumentation           Collector
────────────────────────────────────────────────────────────
PreToolUse: Read        →  Buffer step 1
                           (input captured)

PostToolUse: Read       →  Buffer step 1
                           (output added)

PreToolUse: Edit        →  Buffer step 2

PostToolUse: Edit       →  Buffer step 2

... (8 more steps)

PreToolUse: Bash        →  Buffer step 10
                           (batch full!)
                                                   ← Flush →
                           POST /steps/batch       → Store

Stop: Session ends      →  Flush remaining
                           POST /complete          → Store
```

## Integration Points

### 1. Configuration

Instrumentation needs to know where the collector is:

```typescript
// In your agent app
const lightning = instrument({
  collectorUrl: process.env.COLLECTOR_URL,  // From environment
  apiKey: process.env.LIGHTNING_API_KEY,    // Authentication
  agentId: 'my-agent'                        // Identify this agent
});
```

Collector configuration (in collector service):

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/lightning
PORT=4000
API_KEY=your-secret-key
```

### 2. Authentication

Instrumentation uses Bearer token:

```
Authorization: Bearer {LIGHTNING_API_KEY}
```

Collector validates:

```typescript
app.use((req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

### 3. Data Schema

**Trajectory**:
```typescript
{
  id: string,              // Generated by collector
  agentId: string,         // From instrumentation config
  taskType: string,        // Optional categorization
  startTime: string,       // ISO timestamp
  endTime: string,         // ISO timestamp
  outcome: {
    success: boolean,
    result: any,
    error: string,
    totalSteps: number,
    duration: number
  }
}
```

**TrajectoryStep**:
```typescript
{
  trajectoryId: string,    // Links to trajectory
  stepNumber: number,      // Sequential numbering
  timestamp: string,       // ISO timestamp
  toolName: string,        // "Read", "Edit", etc.
  toolInput: any,          // Sanitized input
  toolOutput: any,         // Sanitized output
  error: string,           // If tool failed
  metadata: any            // Additional context
}
```

## Setup Instructions

### 1. Start Collector

```bash
cd agent-lightning-optimizer/collector
npm install
npm start  # Runs on http://localhost:4000
```

### 2. Install Instrumentation in Your Agent

```bash
npm install @agent-lightning/instrumentation
```

### 3. Configure Environment

```bash
# .env
COLLECTOR_URL=http://localhost:4000
LIGHTNING_API_KEY=your-api-key
AGENT_ID=my-agent
```

### 4. Add to Your Agent

```typescript
import { instrument } from '@agent-lightning/instrumentation';

const lightning = instrument({
  collectorUrl: process.env.COLLECTOR_URL!,
  apiKey: process.env.LIGHTNING_API_KEY!,
  agentId: process.env.AGENT_ID!
});

// Add hooks to your query
options: { hooks: lightning.hooks }
```

### 5. Run Your Agent

```bash
node your-agent.js
```

Trajectories are now being captured!

### 6. Verify Collection

```bash
# Check collector logs
cd agent-lightning-optimizer/collector
npm start

# Should see:
# POST /api/trajectories/start - 200 OK
# POST /api/trajectories/{id}/steps/batch - 200 OK
# POST /api/trajectories/{id}/complete - 200 OK
```

### 7. Run Optimizer (Later)

```bash
cd agent-lightning-optimizer/optimizer
python run_apo.py --trajectories 100

# Generates optimized prompts
```

## API Contract

### Collector Requirements

The collector MUST implement these endpoints:

#### Start Trajectory
```
POST /api/trajectories/start
Content-Type: application/json
Authorization: Bearer {token}

Body:
{
  "agentId": "string",
  "taskType": "string",
  "startTime": "ISO8601 timestamp"
}

Response:
{
  "trajectoryId": "string"
}
```

#### Add Steps (Batch)
```
POST /api/trajectories/{trajectoryId}/steps/batch
Content-Type: application/json
Authorization: Bearer {token}

Body:
{
  "steps": [
    {
      "stepNumber": 1,
      "timestamp": "ISO8601 timestamp",
      "toolName": "string",
      "toolInput": any,
      "toolOutput": any,
      "error": "string"
    }
  ]
}

Response:
{
  "success": true
}
```

#### Complete Trajectory
```
POST /api/trajectories/{trajectoryId}/complete
Content-Type: application/json
Authorization: Bearer {token}

Body:
{
  "success": boolean,
  "result": any,
  "error": "string",
  "totalSteps": number,
  "duration": number,
  "endTime": "ISO8601 timestamp"
}

Response:
{
  "success": true
}
```

## Error Handling

### Collector Down

Instrumentation handles gracefully:

```typescript
// If collector unreachable:
// 1. Error logged (if debug mode)
// 2. Steps queued in buffer
// 3. Retry on next flush
// 4. Agent continues normally

// Agent NEVER crashes due to collector issues
```

### Network Timeout

```typescript
// Built-in timeout handling:
// - Buffer retries failed batches
// - Manual flush available
// - Debug mode shows errors
```

### Authentication Failure

```typescript
// If API key invalid:
// - 401 response logged
// - Agent continues
// - No trajectory captured
// - No crash
```

## Performance Tuning

### Batch Size

```typescript
// More frequent uploads (less buffering)
batchSize: 5

// Less frequent uploads (more efficient)
batchSize: 20

// Default (balanced)
batchSize: 10
```

### Flush Interval

```typescript
// Faster flushing (near real-time)
flushInterval: 1000  // 1 second

// Slower flushing (more efficient)
flushInterval: 10000  // 10 seconds

// Default (balanced)
flushInterval: 5000  // 5 seconds
```

### For Long-Running Agents

```typescript
// Prevent memory buildup
batchSize: 5,          // Small batches
flushInterval: 2000    // Frequent flushing
```

### For High-Volume Agents

```typescript
// Optimize network usage
batchSize: 50,         // Large batches
flushInterval: 10000   // Less frequent
```

## Monitoring

### Instrumentation Metrics

Enable debug mode to see:

```typescript
debug: true

// Logs:
// [Lightning Instrumentation] Initializing...
// [Lightning Hooks] Session started
// [Lightning Hooks] Pre-tool: Read
// [Lightning Hooks] Post-tool: Read
// [StepBuffer] Added step 1
// [LightningClient] POST /api/trajectories/.../steps/batch
```

### Collector Metrics

Check collector logs for:

```
POST /api/trajectories/start - 200 OK (15ms)
POST /api/trajectories/{id}/steps/batch - 200 OK (8ms)
POST /api/trajectories/{id}/complete - 200 OK (5ms)
```

### Database Queries

Monitor PostgreSQL:

```sql
-- Check trajectory count
SELECT COUNT(*) FROM trajectories;

-- Check step count
SELECT COUNT(*) FROM trajectory_steps;

-- Recent trajectories
SELECT * FROM trajectories ORDER BY start_time DESC LIMIT 10;

-- Steps per trajectory
SELECT trajectory_id, COUNT(*) as steps
FROM trajectory_steps
GROUP BY trajectory_id
ORDER BY steps DESC;
```

## Troubleshooting

### No trajectories appearing

1. Check collector is running
2. Verify COLLECTOR_URL is correct
3. Check API_KEY matches
4. Enable debug mode
5. Check network connectivity

### Steps are delayed

This is normal - batching is working. To speed up:

```typescript
batchSize: 1,      // Immediate upload
flushInterval: 0   // No delay
```

### High memory usage

Reduce buffering:

```typescript
batchSize: 5,      // Smaller batches
flushInterval: 1000  // Flush faster
```

### Collector overload

Reduce upload frequency:

```typescript
batchSize: 50,     // Larger batches
flushInterval: 30000  // 30 second delay
```

## Next Steps

1. **Capture Data**: Run agents with instrumentation
2. **Verify Collection**: Check collector dashboard
3. **Accumulate Trajectories**: Need 100+ for APO
4. **Run Optimizer**: Generate improved prompts
5. **Deploy Updates**: Use optimized prompts in agent
6. **Measure Improvement**: Compare performance
7. **Iterate**: Continue collecting and optimizing

## References

- [Instrumentation README](./README.md) - Full documentation
- [Quick Start Guide](./QUICKSTART.md) - Get started in 5 minutes
- [Integration Guide](./INTEGRATION.md) - Detailed setup
- [Main Project README](../README.md) - Agent Lightning overview
- [Collector README](../collector/README.md) - Collector documentation
- [Optimizer README](../optimizer/README.md) - APO documentation
