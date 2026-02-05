import cron from 'node-cron';
import * as db from './db.js';
import { ApprovalService } from './approval.js';
import { DeploymentService } from './deployment.js';
import { MetricsService } from './metrics.js';
import { RegressionDetector } from './regression.js';
import { NotificationService } from './notifications.js';
import type { RegressionConfig } from './types.js';

// =============================================================================
// Configuration
// =============================================================================

const config = {
  port: parseInt(process.env.PORT || '3002', 10),
  evaluationWindowMinutes: parseInt(process.env.EVALUATION_WINDOW_MINUTES || '30', 10),
  minSampleSize: parseInt(process.env.MIN_SAMPLE_SIZE || '50', 10),
  successRateThreshold: parseFloat(process.env.SUCCESS_RATE_THRESHOLD || '0.05'),
  efficiencyThreshold: parseFloat(process.env.EFFICIENCY_THRESHOLD || '0.10'),
  baselineWindowMinutes: parseInt(process.env.BASELINE_WINDOW_MINUTES || '60', 10),
};

const regressionConfig: RegressionConfig = {
  successRateThreshold: config.successRateThreshold,
  efficiencyThreshold: config.efficiencyThreshold,
  minSampleSize: config.minSampleSize,
  evaluationWindowMinutes: config.evaluationWindowMinutes,
};

// =============================================================================
// Service Initialization
// =============================================================================

const notificationService = new NotificationService();
const metricsService = new MetricsService(config.minSampleSize);
const regressionDetector = new RegressionDetector(
  regressionConfig,
  metricsService,
  notificationService
);
const approvalService = new ApprovalService(notificationService);
const deploymentService = new DeploymentService(
  approvalService,
  metricsService,
  regressionDetector,
  notificationService,
  config.baselineWindowMinutes
);

// =============================================================================
// API Server
// =============================================================================

async function handleRequest(
  method: string,
  path: string,
  body: unknown
): Promise<{ status: number; body: unknown }> {
  try {
    // Health check
    if (method === 'GET' && path === '/health') {
      const dbConnected = await db.testConnection();
      return {
        status: dbConnected ? 200 : 503,
        body: {
          status: dbConnected ? 'healthy' : 'unhealthy',
          database: dbConnected ? 'connected' : 'disconnected',
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Approval endpoints
    if (method === 'POST' && path === '/approvals/request') {
      const result = await approvalService.requestApproval(body as Parameters<typeof approvalService.requestApproval>[0]);
      return { status: 201, body: result };
    }

    if (method === 'POST' && path.match(/^\/approvals\/[^/]+\/approve$/)) {
      const versionId = path.split('/')[2];
      const { approverId, reason } = body as { approverId: string; reason?: string };
      const result = await approvalService.approve(versionId, approverId, reason);
      return { status: 200, body: result };
    }

    if (method === 'POST' && path.match(/^\/approvals\/[^/]+\/reject$/)) {
      const versionId = path.split('/')[2];
      const { approverId, reason } = body as { approverId: string; reason: string };
      await approvalService.reject(versionId, approverId, reason);
      return { status: 200, body: { success: true } };
    }

    if (method === 'GET' && path.match(/^\/approvals\/[^/]+$/)) {
      const versionId = path.split('/')[2];
      const result = await approvalService.getApprovalStatus(versionId);
      return { status: 200, body: result };
    }

    if (method === 'GET' && path === '/approvals/pending') {
      const result = await approvalService.listPendingApprovals();
      return { status: 200, body: result };
    }

    // Deployment endpoints
    if (method === 'POST' && path === '/deployments') {
      const result = await deploymentService.deploy(body as Parameters<typeof deploymentService.deploy>[0]);
      return { status: 201, body: result };
    }

    if (method === 'POST' && path.match(/^\/deployments\/[^/]+\/rollback$/)) {
      const deploymentId = path.split('/')[2];
      const { rolledBackBy, reason } = body as { rolledBackBy: string; reason?: string };
      const result = await deploymentService.rollback({
        deploymentId,
        rolledBackBy,
        reason,
      });
      return { status: 200, body: result };
    }

    if (method === 'GET' && path.match(/^\/deployments\/agent\/[^/]+$/)) {
      const agentId = path.split('/')[3];
      const result = await deploymentService.getHistory(agentId);
      return { status: 200, body: result };
    }

    if (method === 'GET' && path.match(/^\/deployments\/agent\/[^/]+\/current$/)) {
      const agentId = path.split('/')[3];
      const result = await deploymentService.getCurrent(agentId);
      return { status: result ? 200 : 404, body: result || { error: 'No current deployment' } };
    }

    if (method === 'GET' && path.match(/^\/deployments\/[^/]+$/)) {
      const deploymentId = path.split('/')[2];
      const result = await deploymentService.getDeploymentWithReport(deploymentId);
      return { status: result ? 200 : 404, body: result || { error: 'Deployment not found' } };
    }

    // Metrics endpoints
    if (method === 'GET' && path.match(/^\/metrics\/agent\/[^/]+$/)) {
      const agentId = path.split('/')[3];
      const windowMinutes = 60; // Default 1 hour
      const result = await metricsService.captureBaseline(agentId, windowMinutes);
      return { status: 200, body: result };
    }

    if (method === 'GET' && path.match(/^\/metrics\/deployment\/[^/]+$/)) {
      const deploymentId = path.split('/')[3];
      const result = await metricsService.getCurrentMetrics(deploymentId);
      return { status: 200, body: result };
    }

    // Regression endpoints
    if (method === 'POST' && path.match(/^\/regression\/evaluate\/[^/]+$/)) {
      const deploymentId = path.split('/')[3];
      const result = await regressionDetector.evaluate(deploymentId);
      return { status: 200, body: result };
    }

    if (method === 'GET' && path.match(/^\/regression\/report\/[^/]+$/)) {
      const deploymentId = path.split('/')[3];
      const result = await db.getRegressionReport(deploymentId);
      return { status: result ? 200 : 404, body: result || { error: 'No regression report' } };
    }

    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    console.error('Request error:', error);
    return {
      status: 500,
      body: { error: error instanceof Error ? error.message : 'Internal server error' },
    };
  }
}

// Simple HTTP server using Node.js built-in http module
async function startServer(): Promise<void> {
  const http = await import('http');

  const server = http.createServer(async (req, res) => {
    const method = req.method || 'GET';
    const url = new URL(req.url || '/', `http://localhost:${config.port}`);
    const path = url.pathname;

    let body: unknown = {};
    if (method === 'POST' || method === 'PUT') {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      const data = Buffer.concat(chunks).toString();
      try {
        body = data ? JSON.parse(data) : {};
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }
    }

    const result = await handleRequest(method, path, body);

    res.writeHead(result.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result.body));
  });

  server.listen(config.port, () => {
    console.log(`Deployer service running on port ${config.port}`);
  });
}

// =============================================================================
// Scheduled Tasks
// =============================================================================

function setupScheduledTasks(): void {
  // Check for expired approval requests every hour
  cron.schedule('0 * * * *', async () => {
    console.log('Checking for expired approval requests...');
    try {
      await db.sql`
        UPDATE approval_requests
        SET status = 'expired'
        WHERE status = 'pending'
        AND expires_at IS NOT NULL
        AND expires_at < NOW()
      `;
    } catch (error) {
      console.error('Failed to expire approval requests:', error);
    }
  });

  // Monitor active deployments for regression every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    console.log('Monitoring active deployments...');
    try {
      // Get all active deployments within the evaluation window
      const windowStart = new Date(
        Date.now() - config.evaluationWindowMinutes * 60 * 1000
      );

      const activeDeployments = await db.sql`
        SELECT d.id, d.prompt_version_id, pv.agent_id
        FROM deployments d
        JOIN prompt_versions pv ON d.prompt_version_id = pv.id
        WHERE d.rolled_back_at IS NULL
        AND d.regression_detected = false
        AND d.deployed_at > ${windowStart}
        AND d.deployed_at < ${new Date(Date.now() - 5 * 60 * 1000)}
      `;

      for (const deployment of activeDeployments) {
        try {
          const report = await regressionDetector.evaluate(deployment.id);
          if (report.autoRollbackTriggered) {
            await deploymentService.autoRollback(
              deployment.id,
              'Automatic rollback triggered by critical regression'
            );
          }
        } catch (error) {
          console.error(`Failed to evaluate deployment ${deployment.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Deployment monitoring failed:', error);
    }
  });

  console.log('Scheduled tasks configured');
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  console.log('Starting Agent Lightning Deployer Service...');
  console.log('Configuration:', {
    port: config.port,
    evaluationWindowMinutes: config.evaluationWindowMinutes,
    minSampleSize: config.minSampleSize,
    successRateThreshold: config.successRateThreshold,
    efficiencyThreshold: config.efficiencyThreshold,
  });

  // Test database connection
  const dbConnected = await db.testConnection();
  if (!dbConnected) {
    console.error('Failed to connect to database. Exiting.');
    process.exit(1);
  }
  console.log('Database connected');

  // Initialize schema
  try {
    await db.initializeDeployerSchema();
    console.log('Database schema initialized');
  } catch (error) {
    console.error('Failed to initialize schema:', error);
    process.exit(1);
  }

  // Setup scheduled tasks
  setupScheduledTasks();

  // Start server
  await startServer();
}

// Export services for external use
export {
  approvalService,
  deploymentService,
  metricsService,
  regressionDetector,
  notificationService,
};

// Export classes for custom instantiation
export { ApprovalService } from './approval.js';
export { DeploymentService } from './deployment.js';
export { MetricsService } from './metrics.js';
export { RegressionDetector } from './regression.js';
export { NotificationService } from './notifications.js';

// Export types
export * from './types.js';

// Run main
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
