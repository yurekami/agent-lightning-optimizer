import { PromptVersion, SelectionResult } from '../types';
import { rankByFitness } from './fitness';

/**
 * Tournament selection: randomly pick `tournamentSize` candidates
 * and return the one with the highest fitness.
 *
 * This provides selection pressure while maintaining diversity.
 */
export function tournamentSelect(
  population: PromptVersion[],
  tournamentSize: number
): PromptVersion {
  if (population.length === 0) {
    throw new Error('Cannot select from empty population');
  }

  if (tournamentSize > population.length) {
    tournamentSize = population.length;
  }

  // Randomly select tournament participants
  const shuffled = [...population].sort(() => Math.random() - 0.5);
  const tournament = shuffled.slice(0, tournamentSize);

  // Return the best from the tournament
  const ranked = rankByFitness(tournament);
  return ranked[0];
}

/**
 * Elitism: always preserve the top K individuals from the population.
 * These pass directly to the next generation without modification.
 */
export function selectElite(population: PromptVersion[], k: number): PromptVersion[] {
  if (k <= 0) return [];
  if (k >= population.length) return [...population];

  const ranked = rankByFitness(population);
  return ranked.slice(0, k);
}

/**
 * Main selection function: combines elitism with tournament selection.
 *
 * Algorithm:
 * 1. Select top `eliteCount` individuals directly (elitism)
 * 2. Fill remaining slots with tournament selection
 *
 * This ensures the best solutions are preserved while still
 * allowing less fit individuals a chance to contribute.
 */
export function selectParents(
  population: PromptVersion[],
  numParents: number,
  eliteCount: number,
  tournamentSize: number = 3
): SelectionResult {
  if (population.length === 0) {
    return { parents: [], elites: [] };
  }

  // Ensure we have enough scored individuals
  const scoredPopulation = population.filter((v) => v.fitness_score !== null);

  // If no scored individuals, randomly select
  if (scoredPopulation.length === 0) {
    const shuffled = [...population].sort(() => Math.random() - 0.5);
    return {
      parents: shuffled.slice(0, numParents),
      elites: [],
    };
  }

  // Select elites
  const actualEliteCount = Math.min(eliteCount, scoredPopulation.length);
  const elites = selectElite(scoredPopulation, actualEliteCount);
  const eliteIds = new Set(elites.map((e) => e.id));

  // Remaining parents needed
  const remainingNeeded = numParents - actualEliteCount;
  const parents: PromptVersion[] = [...elites];

  // Use tournament selection for remaining slots
  // Can select from entire population (including elites for parent pool)
  for (let i = 0; i < remainingNeeded; i++) {
    const selected = tournamentSelect(scoredPopulation, tournamentSize);
    parents.push(selected);
  }

  return { parents, elites };
}

/**
 * Roulette wheel selection: probability proportional to fitness.
 * Alternative to tournament selection, provides stronger pressure
 * towards high-fitness individuals.
 */
export function rouletteSelect(
  population: PromptVersion[],
  relativeFitness: Map<string, number>
): PromptVersion {
  if (population.length === 0) {
    throw new Error('Cannot select from empty population');
  }

  const random = Math.random();
  let cumulative = 0;

  for (const version of population) {
    const fitness = relativeFitness.get(version.id) || 0;
    cumulative += fitness;

    if (random <= cumulative) {
      return version;
    }
  }

  // Fallback to last individual (handles floating point errors)
  return population[population.length - 1];
}

/**
 * Stochastic Universal Sampling (SUS): selects multiple individuals
 * with evenly spaced pointers. Provides more consistent selection
 * than repeated roulette wheel.
 */
export function stochasticUniversalSampling(
  population: PromptVersion[],
  relativeFitness: Map<string, number>,
  numToSelect: number
): PromptVersion[] {
  if (population.length === 0 || numToSelect === 0) {
    return [];
  }

  const selected: PromptVersion[] = [];

  // Calculate total fitness
  let totalFitness = 0;
  for (const version of population) {
    totalFitness += relativeFitness.get(version.id) || 0;
  }

  if (totalFitness === 0) {
    // Random selection if no fitness info
    const shuffled = [...population].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, numToSelect);
  }

  // Pointer spacing
  const pointerDistance = totalFitness / numToSelect;
  let start = Math.random() * pointerDistance;

  // Select individuals
  let cumulative = 0;
  let currentPointer = start;
  let i = 0;

  for (const version of population) {
    cumulative += relativeFitness.get(version.id) || 0;

    while (currentPointer <= cumulative && selected.length < numToSelect) {
      selected.push(version);
      currentPointer += pointerDistance;
    }

    if (selected.length >= numToSelect) break;
  }

  // Fill any remaining slots (handles edge cases)
  while (selected.length < numToSelect) {
    const random = Math.floor(Math.random() * population.length);
    selected.push(population[random]);
  }

  return selected;
}

/**
 * Truncation selection: select only the top percentage of individuals.
 * Simple but effective, especially for large populations.
 */
export function truncationSelect(
  population: PromptVersion[],
  truncationRate: number // e.g., 0.5 means top 50%
): PromptVersion[] {
  const ranked = rankByFitness(population);
  const numToSelect = Math.max(1, Math.floor(population.length * truncationRate));
  return ranked.slice(0, numToSelect);
}

/**
 * Select a diverse subset of parents.
 * Uses a combination of fitness and content diversity.
 * This helps maintain genetic diversity in the population.
 */
export function selectDiverse(
  population: PromptVersion[],
  numToSelect: number,
  diversityWeight: number = 0.3
): PromptVersion[] {
  if (population.length <= numToSelect) {
    return [...population];
  }

  const ranked = rankByFitness(population);
  const selected: PromptVersion[] = [ranked[0]]; // Always include the best

  while (selected.length < numToSelect) {
    let bestCandidate: PromptVersion | null = null;
    let bestScore = -Infinity;

    for (const candidate of ranked) {
      if (selected.some((s) => s.id === candidate.id)) continue;

      // Fitness component
      const fitnessScore = candidate.fitness_score ?? 0;

      // Diversity component: average "distance" from selected
      // Using generation difference as a simple proxy for diversity
      const diversityScore = calculateDiversityScore(candidate, selected);

      // Combined score
      const combinedScore =
        (1 - diversityWeight) * fitnessScore +
        diversityWeight * diversityScore;

      if (combinedScore > bestScore) {
        bestScore = combinedScore;
        bestCandidate = candidate;
      }
    }

    if (bestCandidate) {
      selected.push(bestCandidate);
    } else {
      break;
    }
  }

  return selected;
}

/**
 * Calculate a simple diversity score based on generation difference
 * and parent relationship.
 */
function calculateDiversityScore(
  candidate: PromptVersion,
  selected: PromptVersion[]
): number {
  if (selected.length === 0) return 1;

  let totalDiversity = 0;

  for (const sel of selected) {
    // Generation difference contributes to diversity
    const genDiff = Math.abs(candidate.generation - sel.generation);

    // Different parent means more diverse
    const parentDiff = candidate.parent_version_id !== sel.parent_version_id ? 1 : 0;

    totalDiversity += (genDiff / 10) + parentDiff;
  }

  // Normalize by number of selected
  return totalDiversity / selected.length;
}
