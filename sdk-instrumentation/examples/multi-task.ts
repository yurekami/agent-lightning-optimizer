/**
 * Multi-task example showing how instrumentation handles multiple sequential tasks
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { instrument } from '@agent-lightning/instrumentation';

async function runTask(lightning: any, task: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TASK: ${task}`);
  console.log('='.repeat(60));

  for await (const message of query({
    prompt: task,
    options: {
      allowedTools: ["Read", "Write", "Edit", "Bash", "Grep"],
      hooks: lightning.hooks,
    }
  })) {
    if (message.type === 'text') {
      console.log(message.text);
    }
  }

  // Flush after each task
  await lightning.flush();
  console.log(`✓ Task complete (Trajectory: ${lightning.getTrajectoryId()})`);
}

async function main() {
  const lightning = instrument({
    collectorUrl: process.env.COLLECTOR_URL || 'http://localhost:4000',
    apiKey: process.env.LIGHTNING_API_KEY || 'dev-key',
    agentId: 'multi-task-agent',
    batchSize: 5,
  });

  const tasks = [
    "Create a new file called hello.txt with the content 'Hello, World!'",
    "Read the hello.txt file and confirm its contents",
    "Update hello.txt to include a timestamp",
  ];

  for (const task of tasks) {
    await runTask(lightning, task);
  }

  console.log('\n✓ All tasks complete!');
}

main().catch(console.error);
