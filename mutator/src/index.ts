import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { Database } from './db';
import { MutationService } from './service';
import { MutatorConfig } from './types';

/**
 * Main entry point for the mutation service
 * Polls for mutation requests and processes them
 */

function loadConfig(): MutatorConfig {
  const requiredEnvVars = ['DATABASE_URL', 'ANTHROPIC_API_KEY'];
  const missing = requiredEnvVars.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    databaseUrl: process.env.DATABASE_URL!,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
    pollIntervalMs: parseInt(process.env.MUTATION_POLL_INTERVAL_MS || '10000', 10),
    batchSize: parseInt(process.env.MUTATION_BATCH_SIZE || '5', 10),
    maxConcurrentMutations: parseInt(process.env.MAX_CONCURRENT_MUTATIONS || '3', 10),
    defaultModel: process.env.DEFAULT_MUTATION_MODEL || 'claude-3-5-haiku-20241022',
    complexModel: process.env.COMPLEX_MUTATION_MODEL || 'claude-3-5-sonnet-20241022',
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
    retryBackoffMs: parseInt(process.env.RETRY_BACKOFF_MS || '1000', 10),
    minPromptLength: parseInt(process.env.MIN_PROMPT_LENGTH || '50', 10),
    maxPromptLength: parseInt(process.env.MAX_PROMPT_LENGTH || '100000', 10),
    minSemanticSimilarity: parseFloat(process.env.MIN_SEMANTIC_SIMILARITY || '0.7'),
    logLevel: process.env.LOG_LEVEL || 'info',
  };
}

async function main() {
  console.log('[Mutator] Starting Agent Lightning Mutation Service...');

  const config = loadConfig();
  const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
  const db = new Database(config.databaseUrl);
  const service = new MutationService(anthropic, db, config);

  console.log('[Mutator] Configuration:');
  console.log(`  Default Model: ${config.defaultModel}`);
  console.log(`  Complex Model: ${config.complexModel}`);
  console.log(`  Poll Interval: ${config.pollIntervalMs}ms`);
  console.log(`  Max Concurrent: ${config.maxConcurrentMutations}`);

  // Graceful shutdown
  let isShuttingDown = false;

  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log('\n[Mutator] Shutting down gracefully...');
    await db.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Main loop: continuously generate mutations for candidates
  console.log('[Mutator] Starting mutation loop...\n');

  while (!isShuttingDown) {
    try {
      // Get candidates that need more testing
      const candidates = await db.getCandidatesForTesting(config.batchSize);

      if (candidates.length === 0) {
        console.log('[Mutator] No candidates need mutation, waiting...');
        await sleep(config.pollIntervalMs);
        continue;
      }

      console.log(`[Mutator] Found ${candidates.length} candidates for mutation`);

      // Process candidates in parallel (up to max concurrent)
      const batches = chunkArray(candidates, config.maxConcurrentMutations);

      for (const batch of batches) {
        const promises = batch.map(async candidate => {
          try {
            console.log(
              `[Mutator] Mutating candidate ${candidate.id} (v${candidate.version})`
            );
            await service.applyRandomMutation(candidate.id);
          } catch (error) {
            console.error(
              `[Mutator] Failed to mutate ${candidate.id}: ${error instanceof Error ? error.message : error}`
            );
          }
        });

        await Promise.all(promises);
      }

      console.log('[Mutator] Batch complete, waiting for next cycle...\n');
      await sleep(config.pollIntervalMs);
    } catch (error) {
      console.error(
        `[Mutator] Error in main loop: ${error instanceof Error ? error.message : error}`
      );
      await sleep(config.pollIntervalMs);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Run the service
main().catch(error => {
  console.error('[Mutator] Fatal error:', error);
  process.exit(1);
});
