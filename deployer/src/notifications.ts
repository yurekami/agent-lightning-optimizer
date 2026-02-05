import type { Notification, NotificationType } from './types.js';

export interface NotificationHandler {
  send(notification: Notification): Promise<void>;
}

export class NotificationService {
  private webhookUrl: string | null;
  private enabled: boolean;
  private handlers: Map<NotificationType, NotificationHandler[]> = new Map();

  constructor(webhookUrl?: string, enabled: boolean = true) {
    this.webhookUrl = webhookUrl || process.env.SLACK_WEBHOOK_URL || null;
    this.enabled = enabled && process.env.NOTIFICATION_ENABLED !== 'false';
  }

  /**
   * Send a notification
   */
  async send(notification: Notification): Promise<void> {
    if (!this.enabled) {
      console.log('[Notification disabled]', notification.type, notification.message);
      return;
    }

    // Log the notification
    console.log(
      `[${notification.type.toUpperCase()}] ${notification.message}`,
      JSON.stringify(notification.metadata)
    );

    // Call registered handlers
    const handlers = this.handlers.get(notification.type) || [];
    await Promise.all(handlers.map((h) => h.send(notification)));

    // Send to Slack webhook if configured
    if (this.webhookUrl) {
      await this.sendToSlack(notification);
    }
  }

  /**
   * Send notification to Slack webhook
   */
  private async sendToSlack(notification: Notification): Promise<void> {
    if (!this.webhookUrl) return;

    const color = this.getSlackColor(notification.type);
    const emoji = this.getEmoji(notification.type);

    const payload = {
      attachments: [
        {
          color,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: `${emoji} ${this.formatTitle(notification.type)}`,
                emoji: true,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: notification.message,
              },
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: this.formatMetadata(notification.metadata),
                },
              ],
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `_${notification.timestamp.toISOString()}_`,
                },
              ],
            },
          ],
        },
      ],
    };

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error('Failed to send Slack notification:', response.statusText);
      }
    } catch (error) {
      console.error('Error sending Slack notification:', error);
    }
  }

  /**
   * Get Slack attachment color based on notification type
   */
  private getSlackColor(type: NotificationType): string {
    const colors: Record<NotificationType, string> = {
      approval_needed: '#FFA500', // Orange
      approval_received: '#36A64F', // Green
      approval_rejected: '#DC143C', // Red
      deployed: '#36A64F', // Green
      regression_detected: '#DC143C', // Red
      rollback: '#FFA500', // Orange
      rollback_complete: '#808080', // Gray
    };
    return colors[type] || '#808080';
  }

  /**
   * Get emoji for notification type
   */
  private getEmoji(type: NotificationType): string {
    const emojis: Record<NotificationType, string> = {
      approval_needed: ':clipboard:',
      approval_received: ':white_check_mark:',
      approval_rejected: ':x:',
      deployed: ':rocket:',
      regression_detected: ':warning:',
      rollback: ':rewind:',
      rollback_complete: ':leftwards_arrow_with_hook:',
    };
    return emojis[type] || ':bell:';
  }

  /**
   * Format notification type as human-readable title
   */
  private formatTitle(type: NotificationType): string {
    const titles: Record<NotificationType, string> = {
      approval_needed: 'Approval Needed',
      approval_received: 'Approval Received',
      approval_rejected: 'Approval Rejected',
      deployed: 'Deployment Complete',
      regression_detected: 'Regression Detected',
      rollback: 'Rollback Initiated',
      rollback_complete: 'Rollback Complete',
    };
    return titles[type] || type.replace(/_/g, ' ').toUpperCase();
  }

  /**
   * Format metadata for display
   */
  private formatMetadata(metadata: Record<string, unknown>): string {
    const entries = Object.entries(metadata)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => {
        const formattedKey = key.replace(/([A-Z])/g, ' $1').toLowerCase();
        const formattedValue = typeof value === 'object'
          ? JSON.stringify(value)
          : String(value);
        return `*${formattedKey}:* ${formattedValue}`;
      });

    return entries.join(' | ');
  }

  /**
   * Register a handler for a notification type
   */
  registerHandler(type: NotificationType, handler: NotificationHandler): void {
    const existing = this.handlers.get(type) || [];
    existing.push(handler);
    this.handlers.set(type, existing);
  }

  /**
   * Remove a handler for a notification type
   */
  removeHandler(type: NotificationType, handler: NotificationHandler): void {
    const existing = this.handlers.get(type) || [];
    const filtered = existing.filter((h) => h !== handler);
    this.handlers.set(type, filtered);
  }

  /**
   * Get the configured webhook URL
   */
  async getWebhookUrl(): Promise<string | null> {
    return this.webhookUrl;
  }

  /**
   * Update webhook URL
   */
  setWebhookUrl(url: string | null): void {
    this.webhookUrl = url;
  }

  /**
   * Enable or disable notifications
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if notifications are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}
