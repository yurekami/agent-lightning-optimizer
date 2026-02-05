import * as db from './db.js';
import { NotificationService } from './notifications.js';
import type {
  ApprovalRequest,
  ApprovalStatusResponse,
  ApprovalVote,
  RequestApprovalInput,
} from './types.js';

export class ApprovalService {
  private notificationService: NotificationService;

  constructor(notificationService: NotificationService) {
    this.notificationService = notificationService;
  }

  /**
   * Request approval for a prompt version deployment
   */
  async requestApproval(input: RequestApprovalInput): Promise<ApprovalRequest> {
    // Validate version exists
    const version = await db.getPromptVersion(input.versionId);
    if (!version) {
      throw new Error(`Prompt version ${input.versionId} not found`);
    }

    // Check if already approved or pending
    const existing = await db.getApprovalRequest(input.versionId);
    if (existing) {
      if (existing.status === 'pending') {
        throw new Error('Approval request already pending for this version');
      }
      if (existing.status === 'approved') {
        throw new Error('Version already approved');
      }
    }

    // Calculate expiration
    const expiresAt = input.expiresInHours
      ? new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000)
      : null;

    // Create approval request
    const request = await db.createApprovalRequest({
      versionId: input.versionId,
      agentId: version.agentId,
      requestedBy: input.requestedBy,
      requiredApprovals: input.requiredApprovals,
      expiresAt,
    });

    // Send notification
    await this.notificationService.send({
      type: 'approval_needed',
      message: `Approval needed for ${version.agentId} v${version.version}`,
      metadata: {
        versionId: input.versionId,
        agentId: version.agentId,
        version: version.version,
        requestedBy: input.requestedBy,
        requiredApprovals: input.requiredApprovals,
      },
      timestamp: new Date(),
    });

    return request;
  }

  /**
   * Approve a prompt version
   */
  async approve(
    versionId: string,
    approverId: string,
    reason?: string
  ): Promise<ApprovalStatusResponse> {
    // Validate approver has permission
    const canApprove = await db.canApprove(approverId);
    if (!canApprove) {
      throw new Error('User does not have approval permissions');
    }

    // Get approval request
    const request = await db.getApprovalRequest(versionId);
    if (!request) {
      throw new Error('No approval request found for this version');
    }

    if (request.status !== 'pending') {
      throw new Error(`Cannot approve: request is ${request.status}`);
    }

    // Check if expired
    if (request.expiresAt && new Date() > request.expiresAt) {
      await db.updateApprovalRequestStatus(request.id, 'expired', request.currentApprovals);
      throw new Error('Approval request has expired');
    }

    // Check if already voted
    const hasVoted = await db.hasVoted(request.id, approverId);
    if (hasVoted) {
      throw new Error('You have already voted on this approval');
    }

    // Create vote
    await db.createApprovalVote({
      approvalRequestId: request.id,
      approverId,
      vote: 'approve',
      reason: reason || null,
    });

    // Update approval count
    const newApprovalCount = request.currentApprovals + 1;
    const isFullyApproved = newApprovalCount >= request.requiredApprovals;
    const newStatus = isFullyApproved ? 'approved' : 'pending';

    await db.updateApprovalRequestStatus(request.id, newStatus, newApprovalCount);

    // Update prompt version status if approved
    if (isFullyApproved) {
      await db.updatePromptVersionStatus(versionId, 'approved');

      await this.notificationService.send({
        type: 'approval_received',
        message: `Version ${versionId} has been fully approved and is ready for deployment`,
        metadata: {
          versionId,
          agentId: request.agentId,
          approvalCount: newApprovalCount,
        },
        timestamp: new Date(),
      });
    }

    return this.getApprovalStatus(versionId);
  }

  /**
   * Reject a prompt version
   */
  async reject(
    versionId: string,
    approverId: string,
    reason: string
  ): Promise<void> {
    // Validate approver has permission
    const canApprove = await db.canApprove(approverId);
    if (!canApprove) {
      throw new Error('User does not have approval permissions');
    }

    // Get approval request
    const request = await db.getApprovalRequest(versionId);
    if (!request) {
      throw new Error('No approval request found for this version');
    }

    if (request.status !== 'pending') {
      throw new Error(`Cannot reject: request is ${request.status}`);
    }

    // Create rejection vote
    await db.createApprovalVote({
      approvalRequestId: request.id,
      approverId,
      vote: 'reject',
      reason,
    });

    // Update request status to rejected
    await db.updateApprovalRequestStatus(request.id, 'rejected', request.currentApprovals);

    // Update prompt version status
    await db.updatePromptVersionStatus(versionId, 'candidate');

    await this.notificationService.send({
      type: 'approval_rejected',
      message: `Version ${versionId} has been rejected`,
      metadata: {
        versionId,
        agentId: request.agentId,
        rejectedBy: approverId,
        reason,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Get current approval status for a version
   */
  async getApprovalStatus(versionId: string): Promise<ApprovalStatusResponse> {
    const request = await db.getApprovalRequest(versionId);
    if (!request) {
      throw new Error('No approval request found for this version');
    }

    const votes = await db.getApprovalVotes(request.id);

    // Check expiration
    if (request.status === 'pending' && request.expiresAt && new Date() > request.expiresAt) {
      await db.updateApprovalRequestStatus(request.id, 'expired', request.currentApprovals);
      return {
        request: { ...request, status: 'expired' },
        votes,
        canDeploy: false,
      };
    }

    return {
      request,
      votes,
      canDeploy: request.status === 'approved',
    };
  }

  /**
   * List all pending approvals
   */
  async listPendingApprovals(): Promise<ApprovalRequest[]> {
    return db.listPendingApprovals();
  }

  /**
   * Get approval votes for a request
   */
  async getVotes(versionId: string): Promise<ApprovalVote[]> {
    const request = await db.getApprovalRequest(versionId);
    if (!request) {
      return [];
    }

    return db.getApprovalVotes(request.id);
  }

  /**
   * Check if a version can be deployed (is approved)
   */
  async canDeploy(versionId: string): Promise<boolean> {
    const request = await db.getApprovalRequest(versionId);
    return request?.status === 'approved';
  }
}
