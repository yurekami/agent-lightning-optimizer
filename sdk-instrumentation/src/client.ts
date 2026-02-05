/**
 * HTTP client for Agent Lightning Collector API
 */

import { Trajectory, TrajectoryStep, Outcome } from './types';

export class LightningClient {
  private baseUrl: string;
  private apiKey: string;
  private debug: boolean;

  constructor(baseUrl: string, apiKey: string, debug = false) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
    this.debug = debug;
  }

  private log(...args: any[]) {
    if (this.debug) {
      console.log('[LightningClient]', ...args);
    }
  }

  private async fetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      ...options.headers,
    };

    this.log(`${options.method || 'GET'} ${url}`);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HTTP ${response.status}: ${error}`);
      }

      return response;
    } catch (error) {
      this.log('Request failed:', error);
      throw error;
    }
  }

  /**
   * Start a new trajectory session
   */
  async startTrajectory(agentId: string, taskType?: string): Promise<string> {
    const response = await this.fetch('/api/trajectories/start', {
      method: 'POST',
      body: JSON.stringify({
        agentId,
        taskType,
        startTime: new Date().toISOString(),
      }),
    });

    const data = await response.json() as { trajectoryId: string };
    this.log('Started trajectory:', data.trajectoryId);
    return data.trajectoryId;
  }

  /**
   * Add a single step to an existing trajectory
   */
  async addStep(trajectoryId: string, step: TrajectoryStep): Promise<void> {
    await this.fetch(`/api/trajectories/${trajectoryId}/steps`, {
      method: 'POST',
      body: JSON.stringify(step),
    });

    this.log(`Added step ${step.stepNumber} to trajectory ${trajectoryId}`);
  }

  /**
   * Complete a trajectory with outcome
   */
  async completeTrajectory(trajectoryId: string, outcome: Outcome): Promise<void> {
    await this.fetch(`/api/trajectories/${trajectoryId}/complete`, {
      method: 'POST',
      body: JSON.stringify({
        ...outcome,
        endTime: new Date().toISOString(),
      }),
    });

    this.log('Completed trajectory:', trajectoryId);
  }

  /**
   * Upload a complete trajectory in one batch
   */
  async uploadTrajectory(trajectory: Trajectory): Promise<void> {
    await this.fetch('/api/trajectories', {
      method: 'POST',
      body: JSON.stringify(trajectory),
    });

    this.log('Uploaded trajectory:', trajectory.id);
  }

  /**
   * Batch upload multiple steps
   */
  async addSteps(trajectoryId: string, steps: TrajectoryStep[]): Promise<void> {
    if (steps.length === 0) return;

    await this.fetch(`/api/trajectories/${trajectoryId}/steps/batch`, {
      method: 'POST',
      body: JSON.stringify({ steps }),
    });

    this.log(`Added ${steps.length} steps to trajectory ${trajectoryId}`);
  }

  /**
   * Health check
   */
  async ping(): Promise<boolean> {
    try {
      await this.fetch('/health');
      return true;
    } catch {
      return false;
    }
  }
}
