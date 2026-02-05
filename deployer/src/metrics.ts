import * as db from './db.js';
import type { DeploymentMetrics, MetricsComparison } from './types.js';

export class MetricsService {
  private minSampleSize: number;

  constructor(minSampleSize: number = 50) {
    this.minSampleSize = minSampleSize;
  }

  /**
   * Capture baseline metrics before deployment for an agent
   */
  async captureBaseline(
    agentId: string,
    windowMinutes: number
  ): Promise<DeploymentMetrics> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - windowMinutes * 60 * 1000);

    return db.getTrajectoryMetrics(agentId, startTime, endTime);
  }

  /**
   * Capture metrics after deployment
   */
  async capturePostDeployment(
    deploymentId: string,
    windowMinutes: number
  ): Promise<DeploymentMetrics> {
    const deployment = await db.getDeployment(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    const startTime = new Date(deployment.deployedAt);
    const endTime = new Date(startTime.getTime() + windowMinutes * 60 * 1000);

    return db.getVersionMetrics(deployment.versionId, startTime, endTime);
  }

  /**
   * Get real-time metrics for a deployment since it was deployed
   */
  async getCurrentMetrics(deploymentId: string): Promise<DeploymentMetrics> {
    const deployment = await db.getDeployment(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    const startTime = new Date(deployment.deployedAt);
    const endTime = new Date();

    return db.getVersionMetrics(deployment.versionId, startTime, endTime);
  }

  /**
   * Compare pre and post deployment metrics
   */
  compareMetrics(
    before: DeploymentMetrics,
    after: DeploymentMetrics
  ): MetricsComparison {
    const successRateChange = before.successRate > 0
      ? (after.successRate - before.successRate) / before.successRate
      : after.successRate > 0 ? 1 : 0;

    const efficiencyChange = before.avgEfficiency > 0
      ? (after.avgEfficiency - before.avgEfficiency) / before.avgEfficiency
      : after.avgEfficiency > 0 ? 1 : 0;

    const errorRateChange = before.errorRate > 0
      ? (after.errorRate - before.errorRate) / before.errorRate
      : after.errorRate > 0 ? 1 : 0;

    const sampleSizeSufficient = after.trajectoryCount >= this.minSampleSize;
    const statisticallySignificant = this.isStatisticallySignificant(before, after);

    return {
      baseline: before,
      current: after,
      successRateChange,
      efficiencyChange,
      errorRateChange,
      sampleSizeSufficient,
      statisticallySignificant,
    };
  }

  /**
   * Check if the difference between metrics is statistically significant
   * Using a simplified z-test for proportions
   */
  private isStatisticallySignificant(
    before: DeploymentMetrics,
    after: DeploymentMetrics
  ): boolean {
    // Need minimum sample size
    if (before.trajectoryCount < 30 || after.trajectoryCount < 30) {
      return false;
    }

    // Calculate pooled proportion for success rate
    const p1 = before.successRate;
    const p2 = after.successRate;
    const n1 = before.trajectoryCount;
    const n2 = after.trajectoryCount;

    const pooled = (p1 * n1 + p2 * n2) / (n1 + n2);
    const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));

    if (se === 0) return false;

    const zScore = Math.abs(p1 - p2) / se;

    // z > 1.96 for 95% confidence
    return zScore > 1.96;
  }

  /**
   * Calculate confidence interval for success rate
   */
  calculateConfidenceInterval(
    metrics: DeploymentMetrics,
    confidenceLevel: number = 0.95
  ): { lower: number; upper: number } {
    const p = metrics.successRate;
    const n = metrics.trajectoryCount;

    if (n === 0) {
      return { lower: 0, upper: 0 };
    }

    // Z-score for confidence level (1.96 for 95%)
    const z = confidenceLevel === 0.95 ? 1.96 : confidenceLevel === 0.99 ? 2.576 : 1.645;

    const se = Math.sqrt((p * (1 - p)) / n);
    const margin = z * se;

    return {
      lower: Math.max(0, p - margin),
      upper: Math.min(1, p + margin),
    };
  }

  /**
   * Get metrics trend over time
   */
  async getMetricsTrend(
    agentId: string,
    intervalMinutes: number,
    periods: number
  ): Promise<DeploymentMetrics[]> {
    const trends: DeploymentMetrics[] = [];
    const now = new Date();

    for (let i = periods - 1; i >= 0; i--) {
      const endTime = new Date(now.getTime() - i * intervalMinutes * 60 * 1000);
      const startTime = new Date(endTime.getTime() - intervalMinutes * 60 * 1000);

      const metrics = await db.getTrajectoryMetrics(agentId, startTime, endTime);
      trends.push(metrics);
    }

    return trends;
  }

  /**
   * Aggregate metrics across multiple periods
   */
  aggregateMetrics(metricsList: DeploymentMetrics[]): DeploymentMetrics {
    if (metricsList.length === 0) {
      return {
        successRate: 0,
        avgEfficiency: 0,
        errorRate: 0,
        trajectoryCount: 0,
        avgSteps: 0,
        avgDurationMs: 0,
        period: { start: new Date(), end: new Date() },
      };
    }

    const totalTrajectories = metricsList.reduce((sum, m) => sum + m.trajectoryCount, 0);

    if (totalTrajectories === 0) {
      return {
        successRate: 0,
        avgEfficiency: 0,
        errorRate: 0,
        trajectoryCount: 0,
        avgSteps: 0,
        avgDurationMs: 0,
        period: {
          start: metricsList[0].period.start,
          end: metricsList[metricsList.length - 1].period.end,
        },
      };
    }

    // Weighted average based on trajectory count
    const successRate = metricsList.reduce(
      (sum, m) => sum + m.successRate * m.trajectoryCount,
      0
    ) / totalTrajectories;

    const avgEfficiency = metricsList.reduce(
      (sum, m) => sum + m.avgEfficiency * m.trajectoryCount,
      0
    ) / totalTrajectories;

    const errorRate = metricsList.reduce(
      (sum, m) => sum + m.errorRate * m.trajectoryCount,
      0
    ) / totalTrajectories;

    const avgSteps = metricsList.reduce(
      (sum, m) => sum + m.avgSteps * m.trajectoryCount,
      0
    ) / totalTrajectories;

    const avgDurationMs = metricsList.reduce(
      (sum, m) => sum + m.avgDurationMs * m.trajectoryCount,
      0
    ) / totalTrajectories;

    return {
      successRate,
      avgEfficiency,
      errorRate,
      trajectoryCount: totalTrajectories,
      avgSteps,
      avgDurationMs,
      period: {
        start: metricsList[0].period.start,
        end: metricsList[metricsList.length - 1].period.end,
      },
    };
  }
}
