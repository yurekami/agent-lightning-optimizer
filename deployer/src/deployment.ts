import * as db from './db.js';
import { ApprovalService } from './approval.js';
import { MetricsService } from './metrics.js';
import { RegressionDetector } from './regression.js';
import { NotificationService } from './notifications.js';
import type { Deployment, DeployInput, RollbackInput } from './types.js';

export class DeploymentService {
  private approvalService: ApprovalService;
  private metricsService: MetricsService;
  private regressionDetector: RegressionDetector;
  private notificationService: NotificationService;
  private baselineWindowMinutes: number;

  constructor(
    approvalService: ApprovalService,
    metricsService: MetricsService,
    regressionDetector: RegressionDetector,
    notificationService: NotificationService,
    baselineWindowMinutes: number = 60
  ) {
    this.approvalService = approvalService;
    this.metricsService = metricsService;
    this.regressionDetector = regressionDetector;
    this.notificationService = notificationService;
    this.baselineWindowMinutes = baselineWindowMinutes;
  }

  /**
   * Deploy a prompt version to production
   * Atomic operation: either completes fully or rolls back
   */
  async deploy(input: DeployInput): Promise<Deployment> {
    const { versionId, deployedBy } = input;

    // Validate version exists and is approved
    const version = await db.getPromptVersion(versionId);
    if (!version) {
      throw new Error(`Prompt version ${versionId} not found`);
    }

    // Check approval status
    const canDeploy = await this.approvalService.canDeploy(versionId);
    if (!canDeploy) {
      throw new Error('Version is not approved for deployment');
    }

    // Validate deployer has permission
    const reviewer = await db.getReviewer(deployedBy);
    if (!reviewer || !['developer', 'admin'].includes(reviewer.role)) {
      throw new Error('User does not have deployment permissions');
    }

    // Get current deployment to link as previous
    const currentDeployment = await db.getCurrentDeployment(version.agentId);

    // Capture baseline metrics before deployment
    const metricsBaseline = await this.metricsService.captureBaseline(
      version.agentId,
      this.baselineWindowMinutes
    );

    try {
      // Create deployment record (atomic DB operation)
      const deployment = await db.createDeployment({
        versionId,
        agentId: version.agentId,
        deployedBy,
        previousDeploymentId: currentDeployment?.id || null,
        metricsBaseline,
      });

      // Schedule regression evaluation
      await this.regressionDetector.scheduleEvaluation(deployment.id);

      // Send notification
      await this.notificationService.send({
        type: 'deployed',
        message: `Version ${version.version} deployed to ${version.agentId}`,
        metadata: {
          deploymentId: deployment.id,
          versionId,
          agentId: version.agentId,
          version: version.version,
          deployedBy: reviewer.name,
          previousVersion: currentDeployment?.versionId || null,
        },
        timestamp: new Date(),
      });

      return deployment;
    } catch (error) {
      // If deployment fails, attempt to restore previous state
      if (currentDeployment) {
        try {
          await db.sql`
            UPDATE agents
            SET current_production_version_id = ${currentDeployment.versionId}
            WHERE id = ${version.agentId}
          `;
        } catch (rollbackError) {
          console.error('Failed to restore previous version:', rollbackError);
        }
      }

      throw error;
    }
  }

  /**
   * Rollback a deployment to the previous version
   */
  async rollback(input: RollbackInput): Promise<Deployment> {
    const { deploymentId, rolledBackBy, reason } = input;

    // Get the deployment to rollback
    const deployment = await db.getDeployment(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    if (deployment.rolledBackAt) {
      throw new Error('Deployment has already been rolled back');
    }

    // Validate user has permission
    const reviewer = await db.getReviewer(rolledBackBy);
    if (!reviewer || !['developer', 'admin'].includes(reviewer.role)) {
      throw new Error('User does not have rollback permissions');
    }

    // Get the previous deployment
    const previousDeployment = deployment.previousDeploymentId
      ? await db.getDeployment(deployment.previousDeploymentId)
      : null;

    if (!previousDeployment) {
      throw new Error('No previous deployment to rollback to');
    }

    // Cancel any scheduled regression evaluation
    this.regressionDetector.cancelScheduledEvaluation(deploymentId);

    // Mark current deployment as rolled back
    await db.rollbackDeployment(deploymentId, rolledBackBy, reason || null);

    // Update agent to use previous version
    await db.sql`
      UPDATE agents
      SET current_production_version_id = ${previousDeployment.versionId}
      WHERE id = ${deployment.agentId}
    `;

    // Update previous deployment status to active
    await db.sql`
      UPDATE deployments
      SET status = 'active'
      WHERE id = ${previousDeployment.id}
    `;

    // Update prompt version statuses
    await db.updatePromptVersionStatus(deployment.versionId, 'candidate');
    await db.updatePromptVersionStatus(previousDeployment.versionId, 'production');

    // Send notification
    await this.notificationService.send({
      type: 'rollback_complete',
      message: `Rolled back from version ${deployment.versionId} to ${previousDeployment.versionId}`,
      metadata: {
        deploymentId,
        agentId: deployment.agentId,
        rolledBackVersion: deployment.versionId,
        restoredVersion: previousDeployment.versionId,
        rolledBackBy: reviewer.name,
        reason: reason || 'Manual rollback',
      },
      timestamp: new Date(),
    });

    // Return the restored deployment
    return previousDeployment;
  }

  /**
   * Auto-rollback triggered by regression detection
   */
  async autoRollback(deploymentId: string, reason: string): Promise<Deployment | null> {
    const deployment = await db.getDeployment(deploymentId);
    if (!deployment) {
      console.error(`Cannot auto-rollback: deployment ${deploymentId} not found`);
      return null;
    }

    if (!deployment.previousDeploymentId) {
      console.error(`Cannot auto-rollback: no previous deployment for ${deploymentId}`);
      return null;
    }

    // Send notification about auto-rollback
    await this.notificationService.send({
      type: 'rollback',
      message: `Auto-rollback initiated for deployment ${deploymentId}`,
      metadata: {
        deploymentId,
        agentId: deployment.agentId,
        reason,
        automatic: true,
      },
      timestamp: new Date(),
    });

    // Use system user for auto-rollback (find first admin)
    const [admin] = await db.sql`
      SELECT id FROM reviewers WHERE role = 'admin' LIMIT 1
    `;

    if (!admin) {
      console.error('Cannot auto-rollback: no admin user found');
      return null;
    }

    return this.rollback({
      deploymentId,
      rolledBackBy: admin.id,
      reason: `[AUTO] ${reason}`,
    });
  }

  /**
   * Get deployment history for an agent
   */
  async getHistory(agentId: string, limit: number = 20): Promise<Deployment[]> {
    return db.getDeploymentHistory(agentId, limit);
  }

  /**
   * Get current production deployment for an agent
   */
  async getCurrent(agentId: string): Promise<Deployment | null> {
    return db.getCurrentDeployment(agentId);
  }

  /**
   * Get a specific deployment by ID
   */
  async getDeployment(id: string): Promise<Deployment | null> {
    return db.getDeployment(id);
  }

  /**
   * Check if a version is currently deployed
   */
  async isDeployed(versionId: string): Promise<boolean> {
    const version = await db.getPromptVersion(versionId);
    if (!version) return false;

    const current = await db.getCurrentDeployment(version.agentId);
    return current?.versionId === versionId;
  }

  /**
   * Get deployment with regression report
   */
  async getDeploymentWithReport(id: string): Promise<{
    deployment: Deployment;
    regressionReport: import('./types.js').RegressionReport | null;
  } | null> {
    const deployment = await db.getDeployment(id);
    if (!deployment) return null;

    const regressionReport = await db.getRegressionReport(id);

    return { deployment, regressionReport };
  }
}
