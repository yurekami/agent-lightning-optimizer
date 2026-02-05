/**
 * Example showing manual trajectory completion with custom outcomes
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { instrument } from '@agent-lightning/instrumentation';

async function runAgentTask(taskDescription: string) {
  const lightning = instrument({
    collectorUrl: process.env.COLLECTOR_URL || 'http://localhost:4000',
    apiKey: process.env.LIGHTNING_API_KEY || 'dev-key',
    agentId: 'manual-completion-agent',
    taskType: 'code-generation',
  });

  const startTime = Date.now();
  let stepCount = 0;
  let result: any = null;

  try {
    console.log(`Starting task: ${taskDescription}\n`);

    for await (const message of query({
      prompt: taskDescription,
      options: {
        allowedTools: ["Read", "Write", "Edit", "Bash"],
        hooks: lightning.hooks,
      }
    })) {
      if (message.type === 'text') {
        console.log(message.text);
        result = message.text;
      }

      if (message.type === 'tool_use') {
        stepCount++;
      }
    }

    // Manually complete with success outcome
    await lightning.complete({
      success: true,
      result: {
        summary: 'Task completed successfully',
        output: result,
      },
      totalSteps: stepCount,
      duration: Date.now() - startTime,
      metadata: {
        taskType: 'code-generation',
        complexity: 'medium',
      },
    });

    console.log('\n✓ Task completed successfully');
    console.log(`  Steps: ${stepCount}`);
    console.log(`  Duration: ${Date.now() - startTime}ms`);
    console.log(`  Trajectory: ${lightning.getTrajectoryId()}`);

  } catch (error: any) {
    // Manually complete with failure outcome
    await lightning.complete({
      success: false,
      error: error.message,
      totalSteps: stepCount,
      duration: Date.now() - startTime,
      metadata: {
        errorType: error.name,
        taskType: 'code-generation',
      },
    });

    console.error('\n✗ Task failed:', error.message);
    console.log(`  Steps before failure: ${stepCount}`);
    console.log(`  Duration: ${Date.now() - startTime}ms`);
  }
}

async function main() {
  await runAgentTask(
    "Create a simple Express.js API endpoint that returns 'Hello, World!'"
  );
}

main().catch(console.error);
