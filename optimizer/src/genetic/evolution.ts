import {
  EvolutionConfig,
  EvolutionConfigSchema,
  EvolutionResult,
  GenerationStats,
  PromptVersion,
  PromptContent,
} from '../types';
import { Population } from './population';
import { updateAllFitness, rankByFitness } from './fitness';
import { selectParents, selectElite } from './selection';
import { crossover, uniformCrossover } from './crossover';
import {
  selectMutationType,
  shouldMutate,
  applySimpleMutation,
  MutationService,
  PlaceholderMutationService,
} from './mutation';
import { getGenerationHistory } from '../db';

/**
 * Evolution engine that manages the genetic algorithm loop.
 */
export class EvolutionEngine {
  private config: EvolutionConfig;
  private mutationService: MutationService;

  constructor(
    config: Partial<EvolutionConfig> = {},
    mutationService?: MutationService
  ) {
    this.config = EvolutionConfigSchema.parse(config);
    this.mutationService = mutationService || new PlaceholderMutationService();
  }

  /**
   * Run a single generation of evolution.
   */
  async runGeneration(
    agentId: string,
    branchId: string
  ): Promise<EvolutionResult> {
    const population = new Population(agentId, branchId);
    await population.load();

    const currentGen = await population.getCurrentGeneration();
    const nextGen = currentGen + 1;

    console.log(`[Evolution] Starting generation ${nextGen} for branch ${branchId}`);
    console.log(`[Evolution] Current population size: ${population.getSize()}`);

    // Step 1: Update fitness scores from recent feedback
    console.log('[Evolution] Updating fitness scores...');
    await updateAllFitness(branchId);
    await population.load(); // Reload to get updated scores

    const populationVersions = population.getAll();
    const stats = population.getStats();

    console.log(`[Evolution] Population stats: avg=${stats.avgFitness?.toFixed(3)}, max=${stats.maxFitness?.toFixed(3)}`);

    // Step 2: Check for plateau and adapt mutation rate
    const plateauDetected = await this.detectPlateau(branchId);
    const adaptedMutationRate = plateauDetected
      ? await this.adaptMutationRate(branchId)
      : this.config.mutationRate;

    if (plateauDetected) {
      console.log(`[Evolution] Plateau detected! Adapting mutation rate to ${adaptedMutationRate.toFixed(3)}`);
    }

    // Step 3: Select parents using tournament + elitism
    const scoredPopulation = populationVersions.filter((v) => v.fitness_score !== null);

    if (scoredPopulation.length < 2) {
      console.log('[Evolution] Not enough scored individuals for selection. Skipping generation.');
      return {
        newCandidates: [],
        stats: this.createStats(nextGen, populationVersions, 0, 0, 0, plateauDetected, adaptedMutationRate),
      };
    }

    const { parents, elites } = selectParents(
      scoredPopulation,
      this.config.populationSize,
      this.config.eliteCount,
      this.config.tournamentSize
    );

    console.log(`[Evolution] Selected ${parents.length} parents, ${elites.length} elites`);

    // Step 4: Generate offspring
    const newCandidates: PromptVersion[] = [];
    let crossoverCount = 0;
    let mutationCount = 0;

    // Preserve elites unchanged
    for (const elite of elites) {
      // Elites go to next generation unchanged
      // (They're already in the database, just need to be tracked)
    }

    // Generate new candidates via crossover and mutation
    const targetOffspring = this.config.populationSize - elites.length;

    for (let i = 0; i < targetOffspring; i++) {
      // Select two parents for crossover
      const parent1Index = Math.floor(Math.random() * parents.length);
      let parent2Index = Math.floor(Math.random() * parents.length);

      // Ensure different parents if possible
      if (parents.length > 1) {
        while (parent2Index === parent1Index) {
          parent2Index = Math.floor(Math.random() * parents.length);
        }
      }

      const parent1 = parents[parent1Index];
      const parent2 = parents[parent2Index];

      let offspringContent: PromptContent;

      // Apply crossover with probability
      if (Math.random() < this.config.crossoverRate) {
        const result = uniformCrossover(
          parent1.content,
          parent2.content,
          parent1.id,
          parent2.id
        );
        offspringContent = result.offspring;
        crossoverCount++;
      } else {
        // No crossover - use one parent's content
        offspringContent = { ...parent1.content };
      }

      // Apply mutation with probability
      if (shouldMutate(adaptedMutationRate)) {
        const mutationType = selectMutationType();

        if (await this.mutationService.isAvailable()) {
          offspringContent = await this.mutationService.mutate(offspringContent, mutationType);
        } else {
          // Fallback to simple mutation
          const result = await applySimpleMutation(offspringContent);
          offspringContent = result.mutatedContent;
        }
        mutationCount++;
      }

      // Create new candidate
      const newCandidate = await population.createCandidate(
        offspringContent,
        parent1.id, // Track primary parent
        nextGen
      );

      newCandidates.push(newCandidate);
    }

    console.log(`[Evolution] Created ${newCandidates.length} new candidates`);
    console.log(`[Evolution] Crossovers: ${crossoverCount}, Mutations: ${mutationCount}`);

    // Step 5: Archive old candidates that aren't elite
    const eliteIds = new Set(elites.map((e) => e.id));
    const toArchive = populationVersions
      .filter((v) => v.status === 'candidate' && !eliteIds.has(v.id))
      .map((v) => v.id);

    if (toArchive.length > 0) {
      console.log(`[Evolution] Archiving ${toArchive.length} old candidates`);
      await population.archiveVersions(toArchive);
    }

    const generationStats = this.createStats(
      nextGen,
      [...elites, ...newCandidates],
      elites.length,
      crossoverCount,
      mutationCount,
      plateauDetected,
      adaptedMutationRate
    );

    return {
      newCandidates,
      stats: generationStats,
    };
  }

  /**
   * Detect if evolution has plateaued (no improvement over several generations).
   */
  async detectPlateau(branchId: string): Promise<boolean> {
    const history = await getGenerationHistory(branchId, this.config.plateauThreshold + 1);

    if (history.length < this.config.plateauThreshold) {
      return false; // Not enough history to determine plateau
    }

    // Check if max fitness has improved in the last N generations
    const recentHistory = history.slice(0, this.config.plateauThreshold);
    const maxFitnesses = recentHistory.map((h) => h.maxFitness);

    // Calculate variance in max fitness
    const mean = maxFitnesses.reduce((a, b) => a + b, 0) / maxFitnesses.length;
    const variance = maxFitnesses.reduce((sum, f) => sum + Math.pow(f - mean, 2), 0) / maxFitnesses.length;

    // Low variance indicates plateau
    const varianceThreshold = 0.001; // Tune this based on your fitness scale
    const isLowVariance = variance < varianceThreshold;

    // Also check if there's been any improvement
    const sortedByGen = [...recentHistory].sort((a, b) => b.generation - a.generation);
    const newestMax = sortedByGen[0]?.maxFitness || 0;
    const oldestMax = sortedByGen[sortedByGen.length - 1]?.maxFitness || 0;
    const noImprovement = newestMax <= oldestMax;

    return isLowVariance && noImprovement;
  }

  /**
   * Adapt mutation rate when plateau is detected.
   * Increases mutation to escape local optima.
   */
  async adaptMutationRate(branchId: string): Promise<number> {
    const history = await getGenerationHistory(branchId, this.config.plateauThreshold * 2);

    // Calculate how long we've been in plateau
    const recentHistory = history.slice(0, this.config.plateauThreshold);
    const maxFitnesses = recentHistory.map((h) => h.maxFitness);

    // More aggressive mutation for longer plateaus
    const maxVariance = Math.max(...maxFitnesses) - Math.min(...maxFitnesses);

    // Base increase: double the mutation rate
    let adaptedRate = this.config.mutationRate * 2;

    // Further increase if variance is very low
    if (maxVariance < 0.0001) {
      adaptedRate = Math.min(adaptedRate * 1.5, 0.8); // Cap at 80%
    }

    return Math.min(adaptedRate, 0.8); // Never exceed 80% mutation rate
  }

  /**
   * Create generation statistics.
   */
  private createStats(
    generation: number,
    population: PromptVersion[],
    elitePreserved: number,
    crossovers: number,
    mutations: number,
    plateauDetected: boolean,
    adaptedMutationRate: number
  ): GenerationStats {
    const scores = population
      .map((v) => v.fitness_score)
      .filter((s): s is number => s !== null);

    return {
      generation,
      populationSize: population.length,
      avgFitness: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      maxFitness: scores.length > 0 ? Math.max(...scores) : 0,
      minFitness: scores.length > 0 ? Math.min(...scores) : 0,
      elitePreserved,
      crossovers,
      mutations,
      plateauDetected,
      adaptedMutationRate,
    };
  }

  /**
   * Get current configuration.
   */
  getConfig(): EvolutionConfig {
    return { ...this.config };
  }

  /**
   * Update configuration.
   */
  updateConfig(updates: Partial<EvolutionConfig>): void {
    this.config = EvolutionConfigSchema.parse({ ...this.config, ...updates });
  }

  /**
   * Set mutation service.
   */
  setMutationService(service: MutationService): void {
    this.mutationService = service;
  }
}

/**
 * Run evolution continuously for all active branches.
 */
export async function runEvolutionLoop(
  engine: EvolutionEngine,
  branches: Array<{ agentId: string; branchId: string }>,
  intervalMs: number = 60000
): Promise<void> {
  console.log(`[EvolutionLoop] Starting evolution loop for ${branches.length} branches`);
  console.log(`[EvolutionLoop] Interval: ${intervalMs}ms`);

  const runCycle = async () => {
    for (const { agentId, branchId } of branches) {
      try {
        const result = await engine.runGeneration(agentId, branchId);
        logGenerationStats(branchId, result.stats);
      } catch (error) {
        console.error(`[EvolutionLoop] Error in branch ${branchId}:`, error);
      }
    }
  };

  // Run immediately, then on interval
  await runCycle();

  setInterval(runCycle, intervalMs);
}

/**
 * Log generation statistics.
 */
function logGenerationStats(branchId: string, stats: GenerationStats): void {
  console.log(`
[Generation ${stats.generation}] Branch: ${branchId}
  Population: ${stats.populationSize}
  Fitness: avg=${stats.avgFitness.toFixed(4)}, max=${stats.maxFitness.toFixed(4)}, min=${stats.minFitness.toFixed(4)}
  Operations: elites=${stats.elitePreserved}, crossovers=${stats.crossovers}, mutations=${stats.mutations}
  Adaptation: plateau=${stats.plateauDetected}, mutationRate=${stats.adaptedMutationRate.toFixed(3)}
`);
}
