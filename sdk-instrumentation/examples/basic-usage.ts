/**
 * Basic usage example for @agent-lightning/instrumentation
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { instrument } from '@agent-lightning/instrumentation';

async function main() {
  // Initialize instrumentation
  const lightning = instrument({
    collectorUrl: process.env.COLLECTOR_URL || 'http://localhost:4000',
    apiKey: process.env.LIGHTNING_API_KEY || 'dev-key',
    agentId: 'example-agent',
    taskType: 'code-fix',
    debug: true,
  });

  console.log('Session ID:', lightning.getSessionId());

  // Run a simple query with instrumentation
  for await (const message of query({
    prompt: "Read the README.md file and summarize its contents",
    options: {
      allowedTools: ["Read"],
      hooks: lightning.hooks,  // <-- Add instrumentation hooks
    }
  })) {
    if (message.type === 'text') {
      console.log(message.text);
    }
  }

  console.log('Trajectory ID:', lightning.getTrajectoryId());
  console.log('Done!');
}

main().catch(console.error);
