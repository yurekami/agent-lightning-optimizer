import {
  PromptVersion,
  PromptContent,
} from '../types';
import {
  getPromptVersionsByBranch,
  createPromptVersion,
  updatePromptVersionStatus,
  getMaxGeneration,
} from '../db';

/**
 * Population manages a collection of prompt versions for a specific evolution branch.
 * It handles loading from database, saving new candidates, and retrieving top performers.
 */
export class Population {
  private agentId: string;
  private branchId: string;
  private versions: PromptVersion[] = [];
  private loaded: boolean = false;

  constructor(agentId: string, branchId: string) {
    this.agentId = agentId;
    this.branchId = branchId;
  }

  /**
   * Load the current population from the database.
   * Only loads active and candidate versions.
   */
  async load(): Promise<PromptVersion[]> {
    this.versions = await getPromptVersionsByBranch(this.branchId);
    this.loaded = true;
    return this.versions;
  }

  /**
   * Ensure population is loaded before operations.
   */
  private ensureLoaded(): void {
    if (!this.loaded) {
      throw new Error('Population not loaded. Call load() first.');
    }
  }

  /**
   * Save new prompt versions as candidates.
   * Archives old candidates that aren't in the elite set.
   */
  async save(versions: PromptVersion[]): Promise<void> {
    for (const version of versions) {
      // New versions are already created via createCandidate
      // This method is for bulk status updates if needed
    }
  }

  /**
   * Create a new candidate version and add to population.
   */
  async createCandidate(
    content: PromptContent,
    parentVersionId: string | null,
    generation: number
  ): Promise<PromptVersion> {
    const newVersion = await createPromptVersion(
      this.branchId,
      content,
      parentVersionId,
      generation
    );
    this.versions.push(newVersion);
    return newVersion;
  }

  /**
   * Archive versions that are no longer needed.
   * Typically called to remove old candidates after a new generation.
   */
  async archiveVersions(versionIds: string[]): Promise<void> {
    for (const id of versionIds) {
      await updatePromptVersionStatus(id, 'archived');
      this.versions = this.versions.filter((v) => v.id !== id);
    }
  }

  /**
   * Reject versions that performed poorly.
   */
  async rejectVersions(versionIds: string[]): Promise<void> {
    for (const id of versionIds) {
      await updatePromptVersionStatus(id, 'rejected');
      this.versions = this.versions.filter((v) => v.id !== id);
    }
  }

  /**
   * Promote a candidate to active status.
   */
  async promoteToActive(versionId: string): Promise<void> {
    await updatePromptVersionStatus(versionId, 'active');
    const version = this.versions.find((v) => v.id === versionId);
    if (version) {
      version.status = 'active';
    }
  }

  /**
   * Get the current population size.
   */
  getSize(): number {
    this.ensureLoaded();
    return this.versions.length;
  }

  /**
   * Get all versions in the population.
   */
  getAll(): PromptVersion[] {
    this.ensureLoaded();
    return [...this.versions];
  }

  /**
   * Get the top N versions by fitness score.
   * Versions without fitness scores are ranked last.
   */
  getBestN(n: number): PromptVersion[] {
    this.ensureLoaded();

    const sorted = [...this.versions].sort((a, b) => {
      // Nulls go to the end
      if (a.fitness_score === null && b.fitness_score === null) return 0;
      if (a.fitness_score === null) return 1;
      if (b.fitness_score === null) return -1;
      return b.fitness_score - a.fitness_score;
    });

    return sorted.slice(0, n);
  }

  /**
   * Get versions that have fitness scores.
   */
  getScoredVersions(): PromptVersion[] {
    this.ensureLoaded();
    return this.versions.filter((v) => v.fitness_score !== null);
  }

  /**
   * Get versions without fitness scores (need evaluation).
   */
  getUnscoredVersions(): PromptVersion[] {
    this.ensureLoaded();
    return this.versions.filter((v) => v.fitness_score === null);
  }

  /**
   * Get the current maximum generation number.
   */
  async getCurrentGeneration(): Promise<number> {
    return getMaxGeneration(this.branchId);
  }

  /**
   * Get population statistics.
   */
  getStats(): {
    total: number;
    scored: number;
    unscored: number;
    active: number;
    candidates: number;
    avgFitness: number | null;
    maxFitness: number | null;
    minFitness: number | null;
  } {
    this.ensureLoaded();

    const scored = this.getScoredVersions();
    const scores = scored.map((v) => v.fitness_score as number);

    return {
      total: this.versions.length,
      scored: scored.length,
      unscored: this.getUnscoredVersions().length,
      active: this.versions.filter((v) => v.status === 'active').length,
      candidates: this.versions.filter((v) => v.status === 'candidate').length,
      avgFitness: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
      maxFitness: scores.length > 0 ? Math.max(...scores) : null,
      minFitness: scores.length > 0 ? Math.min(...scores) : null,
    };
  }

  /**
   * Get agent ID.
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * Get branch ID.
   */
  getBranchId(): string {
    return this.branchId;
  }
}
