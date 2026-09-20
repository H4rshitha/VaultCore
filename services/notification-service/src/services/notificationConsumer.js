import amqp from 'amqplib';
import { RabbitMQClient, NOTIFICATION_QUEUES, EVENT_EXCHANGES } from '@vaultcore/shared';
import { NotificationRepository } from '../repositories/notificationRepository.js';
import { NotificationService } from './notificationService.js';
import { config } from '../config/index.js';

export class NotificationConsumer {
  constructor(logger, options = {}) {
    this.logger = logger;
    this.repository = options.repository || new NotificationRepository();
    this.service = options.service || new NotificationService(logger, this.repository);
    this.client = options.client || new RabbitMQClient(logger);

    this.exchange = config.exchange || EVENT_EXCHANGES.BANKING_EVENTS || 'vaultcore.events';
    this.emailQueue = config.emailQueue || NOTIFICATION_QUEUES.EMAIL;
    this.smsQueue = config.smsQueue || NOTIFICATION_QUEUES.SMS;
    this.dlqQueue = config.dlqQueue || NOTIFICATION_QUEUES.DLQ;
    this.maxRetries = options.maxRetries || config.maxRetries || 3;

    this.connection = null;
    this.channel = null;
    this.isRunning = false;
    this.isConnected = false;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.maxReconnectDelayMs = 30000;
    this.amqpUri = config.rabbitmqUri;
    this.startedAt = null;

    // Runtime Metrics
    this.metrics = {
      messagesConsumed: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      dlqCount: 0,
      lastProcessingLatencyMs: 0,
      averageLatencyMs: 0,
      totalLatencyMs: 0,
      startedAt: null,
      uptimeSeconds: 0,
    };
  }

  /**
   * Initialize RabbitMQ connection and setup full topology (Exchange, Queues, DLQ, Bindings)
   */
  async setupTopology(uri) {
    const amqpUri = uri || this.amqpUri || config.rabbitmqUri;
    this.connection = await amqp.connect(amqpUri);
    this.channel = await this.connection.createChannel();
    this.isConnected = true;
    this.reconnectAttempts = 0;

    this.connection.on('error', (err) => {
      if (this.logger)
        this.logger.error(`[RabbitMQ] NotificationConsumer connection error: ${err.message}`);
    });

    this.connection.on('close', () => {
      if (this.logger)
        this.logger.warn(
          '[RabbitMQ] NotificationConsumer connection closed, scheduling reconnect...'
        );
      this.cleanup();
      this.scheduleReconnect();
    });

    // 1. Assert Topic Exchange
    await this.channel.assertExchange(this.exchange, 'topic', { durable: true });

    // 2. Assert Dead Letter Queue (DLQ)
    await this.channel.assertQueue(this.dlqQueue, { durable: true });

    // 3. Assert Email Queue & Bindings
    await this.channel.assertQueue(this.emailQueue, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': this.dlqQueue,
      },
    });
    await this.channel.bindQueue(this.emailQueue, this.exchange, 'payment.completed');
    await this.channel.bindQueue(this.emailQueue, this.exchange, 'payment.failed');
    await this.channel.bindQueue(this.emailQueue, this.exchange, 'notification.email');

    // 4. Assert SMS Queue & Bindings
    await this.channel.assertQueue(this.smsQueue, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': this.dlqQueue,
      },
    });
    await this.channel.bindQueue(this.smsQueue, this.exchange, 'payment.completed');
    await this.channel.bindQueue(this.smsQueue, this.exchange, 'notification.sms');

    if (this.logger) {
      this.logger.info(
        `Notification topology initialized. Listening on [${this.emailQueue}] and [${this.smsQueue}], DLQ: [${this.dlqQueue}]`
      );
    }
  }

  /**
   * Start consuming from Email and SMS queues
   */
  async start(uri) {
    if (this.isRunning && this.isConnected) return;
    this.isRunning = true;
    if (uri) this.amqpUri = uri;
    this.startedAt = this.startedAt || new Date();
    this.metrics.startedAt = this.metrics.startedAt || this.startedAt.toISOString();

    await this.connectAndConsume();
  }

  async connectAndConsume() {
    if (!this.isRunning) return;

    try {
      await this.setupTopology(this.amqpUri);

      // Consume Email Queue
      await this.consumeQueue(this.emailQueue, 'EMAIL');

      // Consume SMS Queue
      await this.consumeQueue(this.smsQueue, 'SMS');

      if (this.logger) {
        this.logger.info('NotificationConsumer started and actively listening for events');
      }
    } catch (error) {
      if (this.logger) {
        this.logger.warn(
          `Failed to connect NotificationConsumer: ${error.message}. Retrying in background...`
        );
      }
      this.cleanup();
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (!this.isRunning || this.reconnectTimer) return;

    this.reconnectAttempts++;
    const delay = Math.min(
      2000 * Math.pow(1.5, this.reconnectAttempts - 1),
      this.maxReconnectDelayMs
    );

    if (this.logger) {
      this.logger.info(
        `[RabbitMQ] NotificationConsumer scheduling reconnect attempt #${this.reconnectAttempts} in ${delay}ms`
      );
    }

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (this.isRunning && !this.isConnected) {
        await this.connectAndConsume();
      }
    }, delay);
  }

  cleanup() {
    this.isConnected = false;
    this.channel = null;
    this.connection = null;
  }

  /**
   * Set up message consumer loop on a designated queue
   */
  async consumeQueue(queueName, notificationType) {
    await this.channel.consume(
      queueName,
      async (msg) => {
        if (!msg) return;
        const startTime = Date.now();
        this.metrics.messagesConsumed += 1;

        const headers = msg.properties.headers || {};
        const routingKey = msg.fields.routingKey;

        let content = {};
        try {
          content = JSON.parse(msg.content.toString());
        } catch (e) {
          content = {};
        }

        const eventId = headers.eventId || content.eventId || `evt-${Date.now()}`;
        const traceId = headers.traceId || content.traceId || `trace-${eventId}`;
        const transactionId =
          headers.transactionId ||
          content.transactionId ||
          content.payload?.transactionId ||
          content.aggregateId;
        const currentRetry =
          typeof headers.retryAttempt === 'number'
            ? headers.retryAttempt
            : content.retryAttempt || 0;

        const logMeta = {
          traceId,
          eventId,
          transactionId,
          queue: queueName,
          routingKey,
          retryAttempt: currentRetry,
        };

        try {
          // 1. Idempotency Check: Verify if eventId was already processed
          const existingAudit = await this.repository.findByEventId(eventId);
          if (existingAudit) {
            if (this.logger) {
              this.logger.info(
                `Duplicate event ignored (already processed): [${eventId}]`,
                logMeta
              );
            }
            this.channel.ack(msg);
            return;
          }

          // 2. Validate and extract payload
          const eventPayload = content.payload || content;
          const eventType = content.eventType || routingKey;

          // 3. Format message & resolve recipient
          const messageTemplate = this.service.formatMessage(eventType, routingKey, eventPayload);
          const recipient = this.service.resolveRecipient(eventPayload, notificationType);

          // 4. Simulate Delivery
          await this.service.deliverNotification({
            notificationType,
            recipient,
            subject: messageTemplate.subject,
            body: messageTemplate.body,
            payload: eventPayload,
          });

          // 5. Store audit record in PostgreSQL
          await this.repository.createAudit({
            eventId,
            transactionId,
            notificationType,
            recipient,
            status: 'SENT',
            retryCount: currentRetry,
            traceId,
            payload: {
              ...eventPayload,
              routingKey,
              subject: messageTemplate.subject,
            },
          });

          // 6. Update latency metrics
          const latencyMs = Date.now() - startTime;
          this.metrics.successfulDeliveries += 1;
          this.metrics.lastProcessingLatencyMs = latencyMs;
          this.metrics.totalLatencyMs += latencyMs;
          this.metrics.averageLatencyMs = Math.round(
            this.metrics.totalLatencyMs /
              (this.metrics.successfulDeliveries + this.metrics.failedDeliveries)
          );

          if (this.logger) {
            this.logger.info(
              `Notification delivered successfully to ${recipient} [${notificationType}]`,
              {
                ...logMeta,
                latencyMs,
              }
            );
          }

          // 7. ACK message
          this.channel.ack(msg);
        } catch (error) {
          const nextRetry = currentRetry + 1;
          this.metrics.failedDeliveries += 1;

          if (this.logger) {
            this.logger.error(`Error processing notification event: ${error.message}`, {
              ...logMeta,
              error: error.message,
              nextRetry,
            });
          }

          if (nextRetry > this.maxRetries) {
            // Exceeded max retries -> Send to Dead Letter Queue (DLQ)
            await this.sendToDLQ(msg, error.message, {
              traceId,
              eventId,
              transactionId,
              routingKey,
              originalQueue: queueName,
              retryAttempt: nextRetry,
            });

            // Record failed audit record in PostgreSQL
            try {
              const recipient = this.service.resolveRecipient(
                content.payload || content,
                notificationType
              );
              await this.repository.createAudit({
                eventId,
                transactionId,
                notificationType,
                recipient,
                status: 'FAILED',
                retryCount: nextRetry,
                errorMessage: error.message,
                traceId,
                payload: content,
              });
            } catch (auditErr) {
              if (this.logger)
                this.logger.warn(`Could not save failed audit log: ${auditErr.message}`);
            }

            // ACK original message so it leaves the primary queue
            this.channel.ack(msg);
          } else {
            // Transient failure -> retry with updated headers
            await this.retryMessage(queueName, routingKey, content, {
              ...headers,
              traceId,
              eventId,
              transactionId,
              retryAttempt: nextRetry,
            });

            // ACK current message to avoid double redelivery
            this.channel.ack(msg);
          }
        }
      },
      { noAck: false }
    );
  }

  /**
   * Re-publish message for retry with incremented retryAttempt header
   */
  async retryMessage(queueName, routingKey, content, headers) {
    const payload = Buffer.from(JSON.stringify(content));
    this.channel.publish(this.exchange, routingKey, payload, {
      persistent: true,
      headers,
    });
    if (this.logger) {
      this.logger.warn(
        `Message scheduled for retry ${headers.retryAttempt}/${this.maxRetries} on [${routingKey}]`,
        {
          eventId: headers.eventId,
          retryAttempt: headers.retryAttempt,
        }
      );
    }
  }

  /**
   * Send unrecoverable message to Dead Letter Queue (DLQ)
   */
  async sendToDLQ(msg, errorMessage, metadata) {
    this.metrics.dlqCount += 1;
    const dlqPayload = Buffer.from(
      JSON.stringify({
        originalMessage: msg.content.toString(),
        error: errorMessage,
        metadata,
        failedAt: new Date().toISOString(),
      })
    );

    this.channel.sendToQueue(this.dlqQueue, dlqPayload, {
      persistent: true,
      headers: {
        ...msg.properties.headers,
        'x-death-reason': errorMessage,
        'x-death-time': new Date().toISOString(),
      },
    });

    if (this.logger) {
      this.logger.error(`Message permanently failed and moved to DLQ [${this.dlqQueue}]`, metadata);
    }
  }

  /**
   * Get runtime metrics
   */
  getMetrics() {
    const uptimeSeconds = this.startedAt
      ? Math.floor((Date.now() - new Date(this.startedAt).getTime()) / 1000)
      : 0;

    return {
      isRunning: this.isRunning,
      maxRetries: this.maxRetries,
      emailQueue: this.emailQueue,
      smsQueue: this.smsQueue,
      dlqQueue: this.dlqQueue,
      uptimeSeconds,
      ...this.metrics,
    };
  }

  /**
   * Stop consumer and close connections cleanly
   */
  async stop() {
    this.isRunning = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
    } catch (err) {
      if (this.logger) this.logger.warn(`Error closing notification consumer: ${err.message}`);
    } finally {
      this.channel = null;
      this.connection = null;
      if (this.logger) this.logger.info('NotificationConsumer stopped cleanly');
    }
  }
}
