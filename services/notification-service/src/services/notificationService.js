import { NotificationRepository } from '../repositories/notificationRepository.js';

export class NotificationService {
  constructor(logger, repository = null) {
    this.logger = logger;
    this.repository = repository || new NotificationRepository();
  }

  /**
   * Determine recipient for event (email or phone)
   */
  resolveRecipient(payload, notificationType = 'EMAIL') {
    if (payload.recipient) return payload.recipient;
    if (payload.email) return payload.email;
    if (payload.phone) return payload.phone;
    if (payload.user?.email) return payload.user.email;
    if (notificationType === 'SMS') {
      return payload.phoneNumber || '+15551234567';
    }
    return 'customer@vaultcore.io';
  }

  /**
   * Format email or SMS message based on event type and payload
   */
  formatMessage(eventType, routingKey, payload) {
    const amount = payload.amount || '0.00';
    const currency = payload.currency || 'USD';
    const referenceId = payload.referenceId || payload.transactionId || 'N/A';

    switch (routingKey) {
      case 'payment.completed':
      case 'PAYMENT_COMPLETED':
        return {
          subject: 'VaultCore Transfer Completed',
          body: `Your payment of ${amount} ${currency} with reference ${referenceId} was completed successfully.`,
          template: 'PAYMENT_COMPLETED_TEMPLATE',
        };

      case 'payment.failed':
      case 'PAYMENT_FAILED':
        return {
          subject: 'VaultCore Transfer Failed',
          body: `Your payment of ${amount} ${currency} with reference ${referenceId} has failed. Reason: ${payload.reason || 'Insufficient funds or verification error'}.`,
          template: 'PAYMENT_FAILED_TEMPLATE',
        };

      case 'payment.reversed':
        return {
          subject: 'VaultCore Transfer Reversed',
          body: `Your transfer with reference ${referenceId} of ${amount} ${currency} has been reversed.`,
          template: 'PAYMENT_REVERSED_TEMPLATE',
        };

      case 'notification.sms':
        return {
          subject: 'VaultCore SMS Alert',
          body: payload.message || `VaultCore Alert: Payment ${referenceId} of ${amount} ${currency} processed.`,
          template: 'SMS_ALERT_TEMPLATE',
        };

      case 'notification.email':
      default:
        return {
          subject: payload.subject || 'VaultCore Account Notification',
          body: payload.message || payload.body || `Notification regarding transaction ${referenceId}.`,
          template: 'GENERIC_NOTIFICATION_TEMPLATE',
        };
    }
  }

  /**
   * Simulate delivery of Email or SMS notification
   */
  async deliverNotification({ notificationType, recipient, subject, body, payload = {} }) {
    const startTime = Date.now();

    // Simulated network latency
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Test simulation trigger for failure
    if (payload.simulateFailure) {
      throw new Error(`Simulated delivery failure to ${recipient}`);
    }

    const deliveryResult = {
      delivered: true,
      notificationType,
      recipient,
      subject,
      deliveryId: `del-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      latencyMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };

    if (this.logger) {
      this.logger.info(`Notification simulated dispatch [${notificationType}] to ${recipient}: "${subject}"`);
    }

    return deliveryResult;
  }

  /**
   * Customer history retrieval scoped by user email/account
   */
  async getCustomerHistory(userContext, queryFilters = {}) {
    const { email, role } = userContext;
    const filters = { ...queryFilters };

    if (role !== 'ADMIN' && role !== 'TELLER') {
      filters.recipient = email;
    }

    return this.repository.getPaginatedHistory(filters);
  }

  /**
   * Admin status aggregation combining database statistics and consumer metrics
   */
  async getAdminStatus(consumerMetrics = {}) {
    const dbStats = await this.repository.getAdminStatistics();

    return {
      status: 'HEALTHY',
      timestamp: new Date().toISOString(),
      queueHealth: {
        emailQueue: 'HEALTHY',
        smsQueue: 'HEALTHY',
        dlqQueue: 'HEALTHY',
      },
      statistics: dbStats,
      consumer: consumerMetrics,
    };
  }
}
