/**
 * Genetic Algorithm Module
 *
 * This module provides the core genetic algorithm components for
 * evolving prompt versions through selection, crossover, and mutation.
 */

// Population management
export { Population } from './population';

// Fitness calculation
export {
  calculateFitness,
  updateAllFitness,
  getFitnessBreakdown,
  rankByFitness,
  calculateRelativeFitness,
} from './fitness';

// Selection algorithms
export {
  tournamentSelect,
  selectElite,
  selectParents,
  rouletteSelect,
  stochasticUniversalSampling,
  truncationSelect,
  selectDiverse,
} from './selection';

// Crossover operators
export {
  singlePointCrossover,
  uniformCrossover,
  blendSystemPrompts,
  sectionCrossover,
  crossover,
  multiParentCrossover,
} from './crossover';

// Mutation operators
export {
  MUTATION_TYPES,
  MUTATION_DESCRIPTIONS,
  selectMutationType,
  selectMutationTypes,
  createPlaceholderMutation,
  SimpleMutations,
  applySimpleMutation,
  shouldMutate,
  PlaceholderMutationService,
  createMutationRequest,
} from './mutation';
export type { MutationService } from './mutation';

// Evolution engine
export { EvolutionEngine, runEvolutionLoop } from './evolution';
