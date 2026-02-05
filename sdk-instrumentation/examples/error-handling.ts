/**
 * Example showing graceful error handling when collector is unavailable
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { instrument } from '@agent-lightning/instrumentation';

async function main() {
  // Intentionally use invalid collector URL to demonstrate graceful degradation
  const lightning = instrument({
    collectorUrl: 'http://invalid-collector-url:9999',
    apiKey: 'invalid-key',
    agentId: 'error-test-agent',
    debug: true,  // See detailed error logs
  });

  console.log('Starting agent with invalid collector URL...');
  console.log('Agent should continue working normally despite collector errors.\n');

  try {
    for await (const message of query({
      prompt: "List all files in the current directory",
      options: {
        allowedTools: ["Bash"],
        hooks: lightning.hooks,
      }
    })) {
      if (message.type === 'text') {
        console.log(message.text);
      }
    }

    console.log('\n✓ Agent completed successfully!');
    console.log('✓ Instrumentation errors were logged but did not crash the agent.');
  } catch (error) {
    console.error('✗ Agent failed:', error);
  }
}

main().catch(console.error);
