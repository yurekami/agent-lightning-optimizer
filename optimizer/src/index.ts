import { EvolutionEngine, runEvolutionLoop } from './genetic';
import { getActiveBranches, closeConnection } from './db';
import { EvolutionConfig } from './types';

/**
 * Load configuration from environment variables.
 */
function loadConfig(): Partial<EvolutionConfig> {
  return {
    populationSize: parseInt(process.env.POPULATION_SIZE || '20', 10),
    eliteCount: parseInt(process.env.ELITE_COUNT || '2', 10),
    tournamentSize: parseInt(process.env.TOURNAMENT_SIZE || '3', 10),
    crossoverRate: parseFloat(process.env.CROSSOVER_RATE || '0.7'),
    mutationRate: parseFloat(process.env.MUTATION_RATE || '0.3'),
    plateauThreshold: parseInt(process.env.PLATEAU_THRESHOLD || '5', 10),
  };
}

/**
 * Main entry point for the optimizer.
 */
async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Agent Lightning Optimizer - Genetic Algorithm Engine');
  console.log('='.repeat(60));

  // Load configuration
  const config = loadConfig();
  console.log('\nConfiguration:');
  console.log(JSON.stringify(config, null, 2));

  // Create evolution engine
  const engine = new EvolutionEngine(config);

  // Get active branches to evolve
  console.log('\nLoading active evolution branches...');
  const branches = await getActiveBranches();

  if (branches.length === 0) {
    console.log('No active evolution branches found.');
    console.log('Create an evolution branch in the database to start optimizing.');
    await closeConnection();
    return;
  }

  console.log(`Found ${branches.length} active branch(es):`);
  for (const branch of branches) {
    console.log(`  - ${branch.name} (${branch.id}) for agent ${branch.agent_id}`);
  }

  // Map branches to the format expected by runEvolutionLoop
  const branchConfigs = branches.map((b) => ({
    agentId: b.agent_id,
    branchId: b.id,
  }));

  // Get evolution interval
  const intervalMs = parseInt(process.env.EVOLUTION_INTERVAL || '60000', 10);
  console.log(`\nEvolution interval: ${intervalMs}ms (${intervalMs / 1000}s)`);

  // Handle graceful shutdown
  let isShuttingDown = false;

  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log('\n\nShutting down optimizer...');
    await closeConnection();
    console.log('Database connection closed.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start evolution loop
  console.log('\nStarting evolution loop...');
  console.log('Press Ctrl+C to stop.\n');

  try {
    await runEvolutionLoop(engine, branchConfigs, intervalMs);
  } catch (error) {
    console.error('Fatal error in evolution loop:', error);
    await closeConnection();
    process.exit(1);
  }
}

// Run if this is the main module
main().catch((error) => {
  console.error('Failed to start optimizer:', error);
  process.exit(1);
});

// Export for programmatic use
export {
  EvolutionEngine,
  runEvolutionLoop,
  loadConfig,
};

export * from './types';
export * from './genetic';
export * from './db';
