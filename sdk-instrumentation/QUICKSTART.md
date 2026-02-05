# Quick Start Guide

Get up and running with Agent Lightning instrumentation in 5 minutes.

## Installation

```bash
npm install @agent-lightning/instrumentation
```

## Minimal Setup (3 steps)

### 1. Import and Configure

```typescript
import { instrument } from '@agent-lightning/instrumentation';

const lightning = instrument({
  collectorUrl: 'http://localhost:4000',
  apiKey: process.env.LIGHTNING_API_KEY!,
  agentId: 'my-agent'
});
```

### 2. Add to Your Agent

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

for await (const message of query({
  prompt: "Your task here",
  options: {
    allowedTools: ["Read", "Edit", "Bash"],
    hooks: lightning.hooks  // <-- Add this line
  }
})) {
  console.log(message);
}
```

### 3. Done!

Trajectories are now automatically captured and sent to your collector.

## What Gets Captured?

- All tool uses (Read, Edit, Bash, etc.)
- Tool inputs and outputs
- Timestamps and step numbers
- Success/failure outcomes
- Agent thinking (if available)

## Configuration Options

```typescript
instrument({
  collectorUrl: 'http://localhost:4000',  // Required: Collector URL
  apiKey: 'your-api-key',                 // Required: Auth token
  agentId: 'my-agent',                    // Required: Agent identifier

  taskType: 'bug-fix',                    // Optional: Task category
  enabled: true,                          // Optional: Enable/disable
  batchSize: 10,                          // Optional: Steps per batch
  flushInterval: 5000,                    // Optional: Auto-flush (ms)
  debug: false                            // Optional: Debug logging
});
```

## Environment Variables

Create a `.env` file:

```bash
COLLECTOR_URL=http://localhost:4000
LIGHTNING_API_KEY=your-api-key-here
```

Use in your code:

```typescript
const lightning = instrument({
  collectorUrl: process.env.COLLECTOR_URL!,
  apiKey: process.env.LIGHTNING_API_KEY!,
  agentId: 'my-agent'
});
```

## Common Patterns

### Debug Mode

```typescript
const lightning = instrument({
  // ...
  debug: true  // See detailed logs
});
```

### Conditional Instrumentation

```typescript
const lightning = instrument({
  // ...
  enabled: process.env.NODE_ENV === 'production'
});
```

### Manual Flushing

```typescript
await lightning.flush();  // Force send buffered steps
```

### Get Session Info

```typescript
console.log('Session:', lightning.getSessionId());
console.log('Trajectory:', lightning.getTrajectoryId());
```

## Troubleshooting

### Collector Not Reachable?

The agent will continue working normally - instrumentation never crashes your agent.

### Steps Not Showing Up?

- Check collector URL is correct
- Verify API key is valid
- Enable debug mode to see logs
- Try manual flush: `await lightning.flush()`

### TypeScript Errors?

Make sure you have the SDK installed:

```bash
npm install @anthropic-ai/claude-agent-sdk
```

## Next Steps

- See `examples/` for complete working examples
- Read `README.md` for full documentation
- Check out the [Agent Lightning Optimizer docs](../README.md)

## Support

- Issues: GitHub Issues
- Examples: `examples/` directory
- Full docs: `README.md`
