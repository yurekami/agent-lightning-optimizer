# @agent-lightning/instrumentation

Lightweight instrumentation for Claude Agent SDK to capture trajectories for [Agent Lightning Optimizer](https://github.com/yourusername/agent-lightning-optimizer) (APO).

## Features

- **Minimal Integration**: Add trajectory capture in less than 10 lines of code
- **Automatic Session Management**: Trajectories are created and managed automatically
- **Efficient Batching**: Steps are buffered and uploaded in batches to reduce network overhead
- **Graceful Degradation**: Never crashes your agent - if collector is down, agent continues normally
- **TypeScript-First**: Full type definitions for excellent IDE support

## Installation

```bash
npm install @agent-lightning/instrumentation
```

## Quick Start

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';
import { instrument } from '@agent-lightning/instrumentation';

// Initialize instrumentation
const lightning = instrument({
  collectorUrl: 'http://localhost:4000',
  apiKey: process.env.LIGHTNING_API_KEY!,
  agentId: 'my-code-agent'
});

// Use with Claude Agent SDK - just add hooks!
for await (const message of query({
  prompt: "Fix the bug in auth.py",
  options: {
    allowedTools: ["Read", "Edit", "Bash"],
    hooks: lightning.hooks  // <-- This is all you need!
  }
})) {
  console.log(message);
}

// Trajectories are automatically captured and sent to collector
```

## Configuration

```typescript
interface InstrumentationConfig {
  // Required
  collectorUrl: string;    // URL of trajectory collector service
  apiKey: string;          // API key for collector authentication
  agentId: string;         // Identifier for this agent

  // Optional
  taskType?: string;       // Task categorization (e.g., "code-fix", "feature")
  enabled?: boolean;       // Enable/disable (default: true)
  batchSize?: number;      // Steps before flushing (default: 10)
  flushInterval?: number;  // Auto-flush interval in ms (default: 5000)
  debug?: boolean;         // Enable debug logging (default: false)
}
```

## Advanced Usage

### Manual Flushing

```typescript
const lightning = instrument(config);

// Manually flush buffered steps
await lightning.flush();
```

### Getting Session Info

```typescript
const lightning = instrument(config);

// Get unique session ID
const sessionId = lightning.getSessionId();

// Get trajectory ID (after first tool use)
const trajectoryId = lightning.getTrajectoryId();
```

### Manual Completion

```typescript
const lightning = instrument(config);

try {
  // Run your agent
  for await (const message of query({ ... })) {
    // ...
  }

  // Manually mark as complete with custom outcome
  await lightning.complete({
    success: true,
    result: { fixedFiles: ['auth.py'] },
    totalSteps: 5,
    duration: 12000
  });
} catch (error) {
  await lightning.complete({
    success: false,
    error: error.message,
    totalSteps: 3,
    duration: 8000
  });
}
```

### Conditional Instrumentation

```typescript
const lightning = instrument({
  collectorUrl: process.env.COLLECTOR_URL!,
  apiKey: process.env.LIGHTNING_API_KEY!,
  agentId: 'my-agent',
  enabled: process.env.NODE_ENV === 'production'  // Only in production
});
```

### Debug Mode

```typescript
const lightning = instrument({
  // ...
  debug: true  // Enable detailed logging
});
```

## Examples

### Code Fixing Agent

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';
import { instrument } from '@agent-lightning/instrumentation';

const lightning = instrument({
  collectorUrl: 'http://localhost:4000',
  apiKey: process.env.LIGHTNING_API_KEY!,
  agentId: 'code-fixer',
  taskType: 'bug-fix',
  batchSize: 5
});

async function fixBug(bugDescription: string) {
  for await (const message of query({
    prompt: `Fix this bug: ${bugDescription}`,
    options: {
      allowedTools: ["Read", "Edit", "Bash", "Grep"],
      hooks: lightning.hooks
    }
  })) {
    if (message.type === 'text') {
      console.log(message.text);
    }
  }
}

await fixBug("Authentication fails for users with special characters in username");
```

### Feature Implementation Agent

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';
import { instrument } from '@agent-lightning/instrumentation';

const lightning = instrument({
  collectorUrl: 'http://localhost:4000',
  apiKey: process.env.LIGHTNING_API_KEY!,
  agentId: 'feature-builder',
  taskType: 'feature-implementation',
  batchSize: 10,
  flushInterval: 3000
});

async function buildFeature(spec: string) {
  console.log(`Building feature: ${spec}`);
  console.log(`Trajectory ID: ${lightning.getTrajectoryId()}`);

  for await (const message of query({
    prompt: spec,
    options: {
      allowedTools: ["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
      hooks: lightning.hooks
    }
  })) {
    if (message.type === 'text') {
      console.log(message.text);
    }
  }

  console.log('Feature complete!');
}

await buildFeature("Add rate limiting to the API endpoints");
```

### Multi-Task Agent

```typescript
import { instrument } from '@agent-lightning/instrumentation';

const lightning = instrument({
  collectorUrl: 'http://localhost:4000',
  apiKey: process.env.LIGHTNING_API_KEY!,
  agentId: 'multi-task-agent'
});

async function runTasks(tasks: string[]) {
  for (const task of tasks) {
    console.log(`\nStarting task: ${task}`);

    // Each task gets its own trajectory automatically
    for await (const message of query({
      prompt: task,
      options: {
        allowedTools: ["Read", "Edit", "Bash"],
        hooks: lightning.hooks
      }
    })) {
      // Process messages
    }

    // Flush between tasks
    await lightning.flush();
  }
}

await runTasks([
  "Fix the SQL injection vulnerability in user.py",
  "Add input validation to the login endpoint",
  "Update the API documentation"
]);
```

## How It Works

1. **Initialization**: When you call `instrument()`, it creates a client and prepares hooks
2. **Lazy Start**: On the first tool use, a trajectory session is started with the collector
3. **Step Capture**: Every tool call (Read, Edit, Bash, etc.) is captured as a trajectory step
4. **Buffered Upload**: Steps are buffered and uploaded in batches for efficiency
5. **Auto-Completion**: When the agent finishes (Stop hook), the trajectory is marked complete

## Architecture

```
┌─────────────────┐
│  Your Agent     │
│  (SDK query)    │
└────────┬────────┘
         │
         │ hooks
         ▼
┌─────────────────┐
│ Instrumentation │
│   - Buffer      │
│   - Client      │
└────────┬────────┘
         │
         │ HTTP
         ▼
┌─────────────────┐
│   Collector     │
│   (REST API)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Database     │
│  (trajectories) │
└─────────────────┘
```

## Error Handling

The instrumentation is designed to **never crash your agent**:

- If collector is unreachable, steps are queued and retried
- If serialization fails, truncated data is sent
- If any error occurs, it's logged but the agent continues normally
- All hooks are wrapped in try-catch blocks

## Data Privacy

- Tool inputs/outputs are sanitized before upload
- Data over 50KB is truncated automatically
- You can disable instrumentation with `enabled: false`
- All data stays on your infrastructure (no external services)

## Performance

- **Minimal Overhead**: Async buffering means near-zero impact on agent performance
- **Batch Uploads**: Steps are uploaded in batches to reduce network calls
- **Automatic Flushing**: Buffer is flushed periodically to prevent memory buildup

## TypeScript Support

Full type definitions are included:

```typescript
import {
  InstrumentationConfig,
  InstrumentationResult,
  Trajectory,
  TrajectoryStep,
  Outcome
} from '@agent-lightning/instrumentation';
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run watch
```

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR on GitHub.

## Support

- GitHub Issues: https://github.com/yourusername/agent-lightning-optimizer/issues
- Documentation: https://github.com/yourusername/agent-lightning-optimizer/docs
