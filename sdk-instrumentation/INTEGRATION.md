# Integration Guide

Step-by-step guide for integrating Agent Lightning instrumentation into your Claude Agent SDK application.

## Prerequisites

- Node.js >= 18.0.0 (for native fetch support)
- Claude Agent SDK >= 0.1.0
- Agent Lightning Collector running (see main project README)

## Installation

```bash
npm install @agent-lightning/instrumentation
```

## Integration Steps

### Step 1: Set Up Environment Variables

Create a `.env` file in your project root:

```bash
# Agent Lightning Configuration
COLLECTOR_URL=http://localhost:4000
LIGHTNING_API_KEY=your-api-key-here
AGENT_ID=my-agent-name
```

Load environment variables in your app:

```javascript
// Using dotenv
require('dotenv').config();

// Or load manually
process.env.COLLECTOR_URL = 'http://localhost:4000';
```

### Step 2: Import and Configure

```typescript
import { instrument } from '@agent-lightning/instrumentation';

const lightning = instrument({
  collectorUrl: process.env.COLLECTOR_URL!,
  apiKey: process.env.LIGHTNING_API_KEY!,
  agentId: process.env.AGENT_ID!,

  // Optional configuration
  taskType: 'code-generation',  // Categorize tasks
  batchSize: 10,                // Steps per batch upload
  flushInterval: 5000,          // Auto-flush every 5 seconds
  debug: false,                 // Enable for troubleshooting
});
```

### Step 3: Add Hooks to Your Agent

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

async function runAgent(prompt: string) {
  for await (const message of query({
    prompt,
    options: {
      allowedTools: ["Read", "Edit", "Bash", "Grep"],
      hooks: lightning.hooks,  // <-- Add this line
    }
  })) {
    // Your existing message handling
    if (message.type === 'text') {
      console.log(message.text);
    }
  }
}
```

### Step 4: That's It!

Your agent now automatically captures trajectories. No additional code needed.

## Advanced Integration Patterns

### Pattern 1: Multi-Task Agent

For agents that handle multiple tasks sequentially:

```typescript
async function processTaskQueue(tasks: string[]) {
  for (const task of tasks) {
    console.log(`Processing: ${task}`);

    // Each task gets its own trajectory
    await runAgent(task);

    // Optional: flush between tasks
    await lightning.flush();
  }
}
```

### Pattern 2: Error Handling with Custom Outcomes

Track success/failure explicitly:

```typescript
async function runAgentWithTracking(prompt: string) {
  const startTime = Date.now();
  let success = false;
  let result: any = null;

  try {
    for await (const message of query({
      prompt,
      options: {
        allowedTools: ["Read", "Edit", "Bash"],
        hooks: lightning.hooks,
      }
    })) {
      result = message;
    }

    success = true;
  } catch (error) {
    console.error('Agent failed:', error);

    // Mark as failure
    await lightning.complete({
      success: false,
      error: error.message,
      totalSteps: 0,
      duration: Date.now() - startTime,
    });

    throw error;
  }

  // Mark as success
  await lightning.complete({
    success: true,
    result,
    totalSteps: 10,  // Track actual steps
    duration: Date.now() - startTime,
  });
}
```

### Pattern 3: Conditional Instrumentation

Enable instrumentation only in certain environments:

```typescript
const lightning = instrument({
  collectorUrl: process.env.COLLECTOR_URL!,
  apiKey: process.env.LIGHTNING_API_KEY!,
  agentId: process.env.AGENT_ID!,

  // Only enable in production or staging
  enabled: ['production', 'staging'].includes(process.env.NODE_ENV || ''),
});
```

### Pattern 4: Per-Task Configuration

Different settings for different task types:

```typescript
function createInstrumentation(taskType: string) {
  return instrument({
    collectorUrl: process.env.COLLECTOR_URL!,
    apiKey: process.env.LIGHTNING_API_KEY!,
    agentId: `${process.env.AGENT_ID}-${taskType}`,
    taskType,

    // Bug fixes need more frequent flushing
    batchSize: taskType === 'bug-fix' ? 5 : 10,
    flushInterval: taskType === 'bug-fix' ? 3000 : 5000,
  });
}

// Usage
const bugFixLightning = createInstrumentation('bug-fix');
const featureLightning = createInstrumentation('feature');
```

### Pattern 5: With Manual Flushing

For long-running agents that need periodic flushing:

```typescript
async function longRunningAgent(prompt: string) {
  let stepCount = 0;

  for await (const message of query({
    prompt,
    options: {
      allowedTools: ["Read", "Edit", "Bash"],
      hooks: lightning.hooks,
    }
  })) {
    // Process message
    console.log(message);

    stepCount++;

    // Manually flush every 20 steps
    if (stepCount % 20 === 0) {
      await lightning.flush();
      console.log(`Flushed ${stepCount} steps`);
    }
  }
}
```

## Collector API Integration

The instrumentation communicates with the collector via REST API:

### Endpoints Used

```
POST /api/trajectories/start
  - Start new trajectory
  - Returns: { trajectoryId: string }

POST /api/trajectories/{id}/steps/batch
  - Upload batch of steps
  - Body: { steps: TrajectoryStep[] }

POST /api/trajectories/{id}/complete
  - Mark trajectory complete
  - Body: { success, result, error, totalSteps, duration }
```

### Authentication

Bearer token authentication:

```
Authorization: Bearer {your-api-key}
```

### Request Format

```json
{
  "agentId": "my-agent",
  "taskType": "bug-fix",
  "startTime": "2024-01-01T12:00:00.000Z"
}
```

### Response Format

```json
{
  "trajectoryId": "traj_abc123",
  "status": "started"
}
```

## Testing Your Integration

### 1. Verify Collector is Running

```bash
curl http://localhost:4000/health
```

Should return: `{ "status": "ok" }`

### 2. Enable Debug Mode

```typescript
const lightning = instrument({
  // ...
  debug: true,  // See detailed logs
});
```

### 3. Run Simple Test

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';
import { instrument } from '@agent-lightning/instrumentation';

const lightning = instrument({
  collectorUrl: 'http://localhost:4000',
  apiKey: 'test-key',
  agentId: 'test-agent',
  debug: true,
});

async function test() {
  console.log('Session:', lightning.getSessionId());

  for await (const message of query({
    prompt: "Say hello",
    options: {
      allowedTools: ["Bash"],
      hooks: lightning.hooks,
    }
  })) {
    console.log(message);
  }

  console.log('Trajectory:', lightning.getTrajectoryId());
  await lightning.flush();
}

test();
```

### 4. Check Collector Logs

Your collector should show:

```
POST /api/trajectories/start - 200 OK
POST /api/trajectories/traj_abc123/steps/batch - 200 OK
POST /api/trajectories/traj_abc123/complete - 200 OK
```

## Troubleshooting

### Issue: No trajectories appearing in collector

**Possible causes:**

1. Collector URL incorrect
   ```typescript
   // Make sure it's the correct URL
   collectorUrl: 'http://localhost:4000'  // Not https://
   ```

2. API key invalid
   ```typescript
   // Check API key is set
   console.log('API Key:', process.env.LIGHTNING_API_KEY);
   ```

3. Network issues
   ```bash
   # Test connectivity
   curl http://localhost:4000/health
   ```

**Solution:** Enable debug mode to see errors:
```typescript
const lightning = instrument({ ..., debug: true });
```

### Issue: Steps are delayed

**Cause:** Batching is working as intended. Steps are sent in batches.

**Solutions:**

1. Reduce batch size:
   ```typescript
   batchSize: 5  // Send more frequently
   ```

2. Reduce flush interval:
   ```typescript
   flushInterval: 2000  // Flush every 2 seconds
   ```

3. Manual flush:
   ```typescript
   await lightning.flush();  // Force send now
   ```

### Issue: Agent crashes when collector is down

**This should never happen!** Instrumentation is designed to fail gracefully.

If it does crash:

1. Check you're using the latest version
2. Enable debug mode to see the error
3. File a bug report with the error stack trace

### Issue: Large payloads are truncated

**This is intentional.** Payloads over 50KB are automatically truncated.

**Solutions:**

1. This is usually fine for APO
2. Increase limit by forking and modifying `hooks.ts`:
   ```typescript
   if (str.length > 100000) {  // Increase from 50000
   ```

### Issue: TypeScript errors

**Common errors:**

1. Missing SDK types:
   ```bash
   npm install @anthropic-ai/claude-agent-sdk
   ```

2. Node types missing:
   ```bash
   npm install --save-dev @types/node
   ```

3. TSConfig issues:
   ```json
   {
     "compilerOptions": {
       "esModuleInterop": true,
       "moduleResolution": "node"
     }
   }
   ```

## Best Practices

### 1. Always Use Environment Variables

```typescript
// ✓ Good
collectorUrl: process.env.COLLECTOR_URL!

// ✗ Bad - hardcoded
collectorUrl: 'http://localhost:4000'
```

### 2. Enable Debug Mode During Development

```typescript
debug: process.env.NODE_ENV === 'development'
```

### 3. Use Task Types for Organization

```typescript
taskType: determineTaskType(prompt)  // 'bug-fix', 'feature', etc.
```

### 4. Flush Before Critical Checkpoints

```typescript
await lightning.flush();  // Before important operations
await criticalOperation();
```

### 5. Handle Long-Running Agents

```typescript
// For agents running >1 hour
flushInterval: 60000  // Flush every minute
```

### 6. Monitor Session IDs

```typescript
const sessionId = lightning.getSessionId();
console.log(`Session ${sessionId} started`);
// Log for debugging and tracking
```

## Production Deployment

### Checklist

- [ ] Environment variables configured
- [ ] Collector URL points to production
- [ ] API keys rotated and secured
- [ ] Debug mode disabled
- [ ] Batch size optimized
- [ ] Error handling tested
- [ ] Network connectivity verified
- [ ] Monitoring in place

### Recommended Production Config

```typescript
const lightning = instrument({
  collectorUrl: process.env.COLLECTOR_URL!,
  apiKey: process.env.LIGHTNING_API_KEY!,
  agentId: process.env.AGENT_ID!,

  enabled: process.env.LIGHTNING_ENABLED === 'true',
  batchSize: 10,
  flushInterval: 5000,
  debug: false,

  taskType: process.env.TASK_TYPE,
});
```

### Environment Variables in Production

```bash
COLLECTOR_URL=https://collector.yourcompany.com
LIGHTNING_API_KEY=prod_key_xxxxx
AGENT_ID=prod-agent
LIGHTNING_ENABLED=true
NODE_ENV=production
```

## Performance Considerations

### Memory Usage

- Default buffer: ~100KB per agent instance
- Large payloads truncated automatically
- Buffer clears on flush

### Network Usage

- Batched uploads reduce requests
- ~1 request per 10 steps (default)
- ~10-50KB per request
- Consider network costs in cloud deployments

### CPU Overhead

- Negligible: <0.5% CPU
- Async operations don't block
- JSON serialization is fast

## Migration from Other Systems

### From Custom Logging

Before:
```typescript
console.log('Tool used:', toolName, input);
```

After:
```typescript
// Just add hooks - logging happens automatically
options: { hooks: lightning.hooks }
```

### From Manual Tracking

Before:
```typescript
db.insertStep({ tool, input, output });
```

After:
```typescript
// Automatic - no manual inserts needed
options: { hooks: lightning.hooks }
```

## Next Steps

1. **Test Integration**: Run examples to verify setup
2. **Capture Trajectories**: Let agent run and capture data
3. **Review in Dashboard**: Check collector dashboard
4. **Run APO**: Use optimizer to improve prompts
5. **Deploy Improvements**: Update agent with optimized prompts

## Support

- **GitHub Issues**: Report bugs and request features
- **Examples**: See `examples/` directory for working code
- **Documentation**: Full docs in `README.md`
- **Community**: Join discussions on GitHub

## Additional Resources

- [Quick Start Guide](QUICKSTART.md)
- [Implementation Details](IMPLEMENTATION.md)
- [Main Project README](../README.md)
- [Collector API Documentation](../collector/README.md)
- [Optimizer Documentation](../optimizer/README.md)
