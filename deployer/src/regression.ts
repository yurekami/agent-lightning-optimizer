import * as db from './db.js';
import { MetricsService } from './metrics.js';
import { NotificationService } from './notifications.js';
import type {
  RegressionConfig,
  RegressionReport,
  RegressionSeverity,
  MetricsComparison,
} from './types.js';

export class RegressionDetector {
  private config: RegressionConfig;
  private metricsService: MetricsService;
  private notificationService: NotificationService;
  private scheduledEvaluations: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    config: RegressionConfig,
    metricsService: MetricsService,
    notificationService: NotificationService
  ) {
    this.config = config;
    this.metricsService = metricsService;
    this.notificationService = notificationService;
  }

  /**
   * Evaluate a deployment for regression
   */
  async evaluate(deploymentId: string): Promise<RegressionReport> {
    const deployment = await db.getDeployment(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    // Get baseline metrics (stored during deployment)
    const baseline = deployment.metricsBaseline;
    if (!baseline) {
      // If no baseline, capture current metrics as comparison
      const currentMetrics = await this.metricsService.getCurrentMetrics(deploymentId);
      return {
        deploymentId,
        detected: false,
        severity: null,
        metrics: {
          baseline: currentMetrics,
          current: currentMetrics,
          successRateChange: 0,
          efficiencyChange: 0,
          errorRateChange: 0,
          sampleSizeSufficient: currentMetrics.trajectoryCount >= this.config.minSampleSize,
          statisticallySignificant: false,
        },
        recommendations: ['No baseline metrics available for comparison'],
        evaluatedAt: new Date(),
        autoRollbackTriggered: false,
      };
    }

    // Get post-deployment metrics
    const currentMetrics = await this.metricsService.capturePostDeployment(
      deploymentId,
      this.config.evaluationWindowMinutes
    );

    // Compare metrics
    const comparison = this.metricsService.compareMetrics(baseline, currentMetrics);

    // Determine if regression detected
    const { detected, severity } = this.detectRegression(comparison);

    // Generate recommendations
    const recommendations = this.generateRecommendations(comparison, detected, severity);

    // Determine if auto-rollback should be triggered
    const autoRollbackTriggered = this.shouldAutoRollback(detected, severity, comparison);

    // Create and save report
    const report: RegressionReport = {
      deploymentId,
      detected,
      severity,
      metrics: comparison,
      recommendations,
      evaluatedAt: new Date(),
      autoRollbackTriggered,
    };

    await db.createRegressionReport({
      deploymentId,
      detected,
      severity,
      metrics: comparison,
      recommendations,
      autoRollbackTriggered,
    });

    // Update deployment with regression status
    await db.updateDeploymentMetrics(deploymentId, currentMetrics, detected);

    // Send notification if regression detected
    if (detected) {
      await this.notificationService.send({
        type: 'regression_detected',
        message: `Regression detected in deployment ${deploymentId}: ${severity} severity`,
        metadata: {
          deploymentId,
          severity,
          successRateChange: comparison.successRateChange,
          efficiencyChange: comparison.efficiencyChange,
          recommendations,
          autoRollbackTriggered,
        },
        timestamp: new Date(),
      });
    }

    return report;
  }

  /**
   * Detect if regression occurred and determine severity
   */
  private detectRegression(
    comparison: MetricsComparison
  ): { detected: boolean; severity: RegressionSeverity | null } {
    // Need sufficient sample size
    if (!comparison.sampleSizeSufficient) {
      return { detected: false, severity: null };
    }

    const successRateDrop = -comparison.successRateChange;
    const efficiencyDrop = -comparison.efficiencyChange;
    const errorRateIncrease = comparison.errorRateChange;

    // No regression if improvements or minor changes
    if (
      successRateDrop <= this.config.successRateThreshold &&
      efficiencyDrop <= this.config.efficiencyThreshold &&
      errorRateIncrease <= this.config.successRateThreshold
    ) {
      return { detected: false, severity: null };
    }

    // Determine severity
    let severity: RegressionSeverity;

    if (successRateDrop > 0.20 || errorRateIncrease > 0.20) {
      severity = 'critical';
    } else if (successRateDrop > 0.10 || errorRateIncrease > 0.10) {
      severity = 'high';
    } else if (
      successRateDrop > this.config.successRateThreshold ||
      efficiencyDrop > this.config.efficiencyThreshold
    ) {
      severity = 'medium';
    } else {
      severity = 'low';
    }

    return { detected: true, severity };
  }

  /**
   * Generate recommendations based on regression analysis
   */
  private generateRecommendations(
    comparison: MetricsComparison,
    detected: boolean,
    severity: RegressionSeverity | null
  ): string[] {
    const recommendations: string[] = [];

    if (!comparison.sampleSizeSufficient) {
      recommendations.push(
        `Insufficient sample size (${comparison.current.trajectoryCount}/${this.config.minSampleSize}). ` +
        'Wait for more trajectories before making decisions.'
      );
      return recommendations;
    }

    if (!detected) {
      if (comparison.successRateChange > 0.05) {
        recommendations.push(
          `Success rate improved by ${(comparison.successRateChange * 100).toFixed(1)}%. ` +
          'Consider this deployment successful.'
        );
      }
      if (comparison.efficiencyChange > 0.05) {
        recommendations.push(
          `Efficiency improved by ${(comparison.efficiencyChange * 100).toFixed(1)}%. ` +
          'Performance is better than baseline.'
        );
      }
      if (recommendations.length === 0) {
        recommendations.push('No significant changes detected. Deployment is stable.');
      }
      return recommendations;
    }

    // Regression detected - provide specific recommendations
    if (severity === 'critical') {
      recommendations.push(
        'CRITICAL: Immediate rollback recommended. Significant degradation detected.'
      );
    } else if (severity === 'high') {
      recommendations.push(
        'HIGH: Consider immediate rollback. Substantial degradation in performance.'
      );
    }

    if (comparison.successRateChange < -this.config.successRateThreshold) {
      recommendations.push(
        `Success rate dropped by ${(-comparison.successRateChange * 100).toFixed(1)}%. ` +
        'Investigate task completion issues.'
      );
    }

    if (comparison.efficiencyChange < -this.config.efficiencyThreshold) {
      recommendations.push(
        `Efficiency dropped by ${(-comparison.efficiencyChange * 100).toFixed(1)}%. ` +
        'Check for increased step counts or longer execution times.'
      );
    }

    if (comparison.errorRateChange > this.config.successRateThreshold) {
      recommendations.push(
        `Error rate increased by ${(comparison.errorRateChange * 100).toFixed(1)}%. ` +
        'Review error logs for new failure patterns.'
      );
    }

    if (!comparison.statisticallySignificant) {
      recommendations.push(
        'Note: Changes are not statistically significant. ' +
        'Consider gathering more data before taking action.'
      );
    }

    return recommendations;
  }

  /**
   * Determine if automatic rollback should be triggered
   */
  private shouldAutoRollback(
    detected: boolean,
    severity: RegressionSeverity | null,
    comparison: MetricsComparison
  ): boolean {
    if (!detected) return false;

    // Only auto-rollback for critical severity with statistical significance
    if (severity === 'critical' && comparison.statisticallySignificant) {
      return true;
    }

    return false;
  }

  /**
   * Schedule an evaluation after the evaluation window
   */
  async scheduleEvaluation(deploymentId: string): Promise<void> {
    // Cancel any existing scheduled evaluation
    const existing = this.scheduledEvaluations.get(deploymentId);
    if (existing) {
      clearTimeout(existing);
    }

    const delayMs = this.config.evaluationWindowMinutes * 60 * 1000;

    const timeout = setTimeout(async () => {
      try {
        await this.evaluate(deploymentId);
      } catch (error) {
        console.error(`Failed to evaluate deployment ${deploymentId}:`, error);
      } finally {
        this.scheduledEvaluations.delete(deploymentId);
      }
    }, delayMs);

    this.scheduledEvaluations.set(deploymentId, timeout);

    console.log(
      `Scheduled regression evaluation for deployment ${deploymentId} ` +
      `in ${this.config.evaluationWindowMinutes} minutes`
    );
  }

  /**
   * Cancel a scheduled evaluation
   */
  cancelScheduledEvaluation(deploymentId: string): void {
    const timeout = this.scheduledEvaluations.get(deploymentId);
    if (timeout) {
      clearTimeout(timeout);
      this.scheduledEvaluations.delete(deploymentId);
    }
  }

  /**
   * Get all pending evaluations
   */
  getPendingEvaluations(): string[] {
    return Array.from(this.scheduledEvaluations.keys());
  }

  /**
   * Check for regression on an existing deployment (manual trigger)
   */
  async checkRegression(deploymentId: string): Promise<RegressionReport | null> {
    const existing = await db.getRegressionReport(deploymentId);
    if (existing) {
      return existing;
    }

    return this.evaluate(deploymentId);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<RegressionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): RegressionConfig {
    return { ...this.config };
  }
}
