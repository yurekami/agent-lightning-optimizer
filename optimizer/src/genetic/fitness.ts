import {
  FitnessScore,
  FitnessWeights,
  PromptVersion,
} from '../types';
import {
  getComparisonsByVersion,
  getTrajectoriesByVersion,
  getPromptVersionsByBranch,
  updatePromptVersionFitness,
} from '../db';

/**
 * Default weights for fitness calculation.
 * winRate is weighted highest as it directly measures comparison performance.
 */
const DEFAULT_WEIGHTS: FitnessWeights = {
  winRate: 0.5,
  successRate: 0.3,
  efficiency: 0.2,
};

/**
 * Minimum number of comparisons required for a reliable fitness score.
 * Versions with fewer comparisons get penalized.
 */
const MIN_COMPARISONS_FOR_RELIABILITY = 5;

/**
 * Calculate fitness score for a specific prompt version.
 * Combines win rate from comparisons, success rate from trajectories,
 * and average efficiency rating.
 */
export async function calculateFitness(
  versionId: string,
  weights: FitnessWeights = DEFAULT_WEIGHTS
): Promise<FitnessScore> {
  // Get all comparisons involving this version
  const comparisons = await getComparisonsByVersion(versionId);

  // Get all trajectories for this version
  const trajectories = await getTrajectoriesByVersion(versionId);

  // Calculate win rate
  let wins = 0;
  let totalComparisons = 0;

  for (const comparison of comparisons) {
    totalComparisons++;

    if (comparison.version_a_id === versionId) {
      if (comparison.winner === 'a') {
        wins += comparison.confidence;
      } else if (comparison.winner === 'tie') {
        wins += 0.5 * comparison.confidence;
      }
    } else if (comparison.version_b_id === versionId) {
      if (comparison.winner === 'b') {
        wins += comparison.confidence;
      } else if (comparison.winner === 'tie') {
        wins += 0.5 * comparison.confidence;
      }
    }
  }

  const winRate = totalComparisons > 0 ? wins / totalComparisons : 0.5; // Default to 0.5 if no comparisons

  // Calculate success rate from trajectories
  const completedTrajectories = trajectories.filter((t) => t.success !== null);
  const successfulTrajectories = completedTrajectories.filter((t) => t.success === true);
  const successRate = completedTrajectories.length > 0
    ? successfulTrajectories.length / completedTrajectories.length
    : 0.5; // Default to 0.5 if no data

  // Calculate average efficiency
  const trajectoriesWithEfficiency = trajectories.filter((t) => t.efficiency_rating !== null);
  const avgEfficiency = trajectoriesWithEfficiency.length > 0
    ? trajectoriesWithEfficiency.reduce((sum, t) => sum + (t.efficiency_rating as number), 0) / trajectoriesWithEfficiency.length
    : 0.5; // Default to 0.5 if no data (assuming 0-1 scale)

  // Calculate composite score with weights
  let composite = (
    weights.winRate * winRate +
    weights.successRate * successRate +
    weights.efficiency * avgEfficiency
  );

  // Apply reliability penalty for versions with few comparisons
  if (totalComparisons < MIN_COMPARISONS_FOR_RELIABILITY) {
    const reliabilityFactor = totalComparisons / MIN_COMPARISONS_FOR_RELIABILITY;
    // Blend towards 0.5 (neutral) for unreliable scores
    composite = composite * reliabilityFactor + 0.5 * (1 - reliabilityFactor);
  }

  return {
    winRate,
    successRate,
    avgEfficiency,
    comparisonCount: totalComparisons,
    composite,
  };
}

/**
 * Calculate fitness for a single comparison outcome.
 * Used for incremental fitness updates.
 */
export function calculateComparisonFitnessDelta(
  isWinner: boolean,
  isTie: boolean,
  confidence: number
): number {
  if (isWinner) {
    return confidence;
  } else if (isTie) {
    return 0.5 * confidence;
  }
  return 0;
}

/**
 * Update fitness scores for all versions in a branch.
 * Should be called before each evolution generation.
 */
export async function updateAllFitness(
  branchId: string,
  weights: FitnessWeights = DEFAULT_WEIGHTS
): Promise<Map<string, FitnessScore>> {
  const versions = await getPromptVersionsByBranch(branchId);
  const fitnessMap = new Map<string, FitnessScore>();

  for (const version of versions) {
    const fitness = await calculateFitness(version.id, weights);
    fitnessMap.set(version.id, fitness);

    // Update database with composite score
    await updatePromptVersionFitness(version.id, fitness.composite);
  }

  return fitnessMap;
}

/**
 * Get fitness breakdown for a version (useful for debugging/analysis).
 */
export async function getFitnessBreakdown(versionId: string): Promise<{
  fitness: FitnessScore;
  comparisons: {
    total: number;
    wins: number;
    losses: number;
    ties: number;
  };
  trajectories: {
    total: number;
    successful: number;
    failed: number;
    pending: number;
  };
}> {
  const comparisons = await getComparisonsByVersion(versionId);
  const trajectories = await getTrajectoriesByVersion(versionId);
  const fitness = await calculateFitness(versionId);

  let wins = 0;
  let losses = 0;
  let ties = 0;

  for (const comparison of comparisons) {
    const isVersionA = comparison.version_a_id === versionId;

    if (comparison.winner === 'tie') {
      ties++;
    } else if (
      (isVersionA && comparison.winner === 'a') ||
      (!isVersionA && comparison.winner === 'b')
    ) {
      wins++;
    } else {
      losses++;
    }
  }

  return {
    fitness,
    comparisons: {
      total: comparisons.length,
      wins,
      losses,
      ties,
    },
    trajectories: {
      total: trajectories.length,
      successful: trajectories.filter((t) => t.success === true).length,
      failed: trajectories.filter((t) => t.success === false).length,
      pending: trajectories.filter((t) => t.success === null).length,
    },
  };
}

/**
 * Rank versions by their fitness scores.
 * Returns sorted array from best to worst.
 */
export function rankByFitness(versions: PromptVersion[]): PromptVersion[] {
  return [...versions].sort((a, b) => {
    // Nulls go to the end
    if (a.fitness_score === null && b.fitness_score === null) return 0;
    if (a.fitness_score === null) return 1;
    if (b.fitness_score === null) return -1;
    return b.fitness_score - a.fitness_score;
  });
}

/**
 * Calculate relative fitness (normalized within population).
 * Useful for selection probability calculations.
 */
export function calculateRelativeFitness(versions: PromptVersion[]): Map<string, number> {
  const relativeFitness = new Map<string, number>();

  const scoredVersions = versions.filter((v) => v.fitness_score !== null);

  if (scoredVersions.length === 0) {
    // All versions get equal fitness if none are scored
    for (const version of versions) {
      relativeFitness.set(version.id, 1 / versions.length);
    }
    return relativeFitness;
  }

  const scores = scoredVersions.map((v) => v.fitness_score as number);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const range = maxScore - minScore;

  if (range === 0) {
    // All scored versions have same fitness
    for (const version of versions) {
      relativeFitness.set(version.id, 1 / versions.length);
    }
    return relativeFitness;
  }

  // Normalize scores to [0, 1] range
  let totalNormalized = 0;
  for (const version of scoredVersions) {
    const normalized = (version.fitness_score as number - minScore) / range;
    relativeFitness.set(version.id, normalized);
    totalNormalized += normalized;
  }

  // Normalize so they sum to 1 (probability distribution)
  if (totalNormalized > 0) {
    for (const [id, score] of relativeFitness) {
      relativeFitness.set(id, score / totalNormalized);
    }
  }

  // Unscored versions get average probability
  const avgProbability = 1 / versions.length;
  for (const version of versions) {
    if (!relativeFitness.has(version.id)) {
      relativeFitness.set(version.id, avgProbability);
    }
  }

  return relativeFitness;
}
