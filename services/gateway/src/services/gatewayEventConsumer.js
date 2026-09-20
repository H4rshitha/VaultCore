import amqp from 'amqplib';
import { EVENT_EXCHANGES, EVENT_ROUTING_KEYS } from '@vaultcore/shared';
import { broadcastSSEEvent } from '../app.js';
import { config } from '../config/index.js';

export class GatewayEventConsumer {
  constructor(logger, options = {}) {
    this.logger = logger;
    this.exchange = options.exchange || EVENT_EXCHANGES.BANKING_EVENTS || 'vaultcore.events';
    this.queue = options.queue || 'vaultcore.gateway.sse.queue';
    this.uri = options.uri || config.rabbitmqUri;

    this.connection = null;
    this.channel = null;
    this.isRunning = false;
    this.isConnected = false;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.maxReconnectDelayMs = 30000;
    this.amqpUri = config.rabbitmqUri;

    this.metrics = {
      messagesReceived: 0,
      eventsBroadcasted: 0,
      errors: 0,
      lastEventAt: null,
      startedAt: null,
    };
  }

  /**
   * Start the RabbitMQ consumer with auto-reconnection
   */
  async start(uri) {
    if (this.isRunning && this.isConnected) return;
    this.isRunning = true;
    this.metrics.startedAt = this.metrics.startedAt || new Date().toISOString();
    if (uri) this.amqpUri = uri;

    await this.connectAndConsume();
  }

  async connectAndConsume() {
    if (!this.isRunning) return;
    const amqpUri = this.amqpUri;

    try {
      if (this.logger) {
        this.logger.info(
          `[RabbitMQ] Connecting to broker at ${amqpUri.replace(/:[^:@]+@/, ':***@')}...`
        );
      }

      this.connection = await amqp.connect(amqpUri);
      this.channel = await this.connection.createChannel();
      this.isConnected = true;
      this.reconnectAttempts = 0;

      this.connection.on('error', (err) => {
        if (this.logger) this.logger.error(`[RabbitMQ] Connection error: ${err.message}`);
      });

      this.connection.on('close', () => {
        if (this.logger) this.logger.warn('[RabbitMQ] Connection closed, scheduling reconnect...');
        this.cleanup();
        this.scheduleReconnect();
      });

      // 1. Assert Topic Exchange
      await this.channel.assertExchange(this.exchange, 'topic', { durable: true });

      // 2. Assert Dedicated SSE Gateway Queue
      await this.channel.assertQueue(this.queue, {
        durable: true,
        arguments: {
          'x-message-ttl': 86400000, // 24 hours message TTL
        },
      });

      // 3. Bind to all relevant banking and notification routing keys
      const routingKeys = [
        'payment.completed',
        'payment.failed',
        'payment.reversed',
        'notification.email',
        'notification.sms',
        'notification.created',
        'account.balance.updated',
        'account.created',
        'ledger.entry.created',
        'circuit-breaker.state.changed',
        EVENT_ROUTING_KEYS.PAYMENT_COMPLETED || 'payment.completed',
        EVENT_ROUTING_KEYS.PAYMENT_FAILED || 'payment.failed',
        EVENT_ROUTING_KEYS.NOTIFICATION_EMAIL || 'notification.email',
        EVENT_ROUTING_KEYS.NOTIFICATION_SMS || 'notification.sms',
      ];

      const uniqueKeys = [...new Set(routingKeys.filter(Boolean))];
      for (const key of uniqueKeys) {
        await this.channel.bindQueue(this.queue, this.exchange, key);
      }

      if (this.logger) {
        this.logger.info(
          `[RabbitMQ] Gateway SSE queue [${this.queue}] bound to exchange [${this.exchange}] for keys: ${uniqueKeys.join(', ')}`
        );
      }

      // 4. Start Consuming
      await this.channel.consume(
        this.queue,
        async (msg) => {
          if (!msg) return;

          this.metrics.messagesReceived++;
          const routingKey = msg.fields.routingKey;

          try {
            let content = {};
            try {
              content = JSON.parse(msg.content.toString());
            } catch {
              content = {};
            }

            const headers = msg.properties.headers || {};
            const eventPayload = content.payload || content;
            const eventType = content.eventType || routingKey;
            const eventId =
              headers.eventId ||
              content.eventId ||
              content.id ||
              `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            const traceId = headers.traceId || content.traceId || `trace-${eventId}`;

            if (this.logger) {
              this.logger.info(`[RabbitMQ] Received [${routingKey}] event (eventId: ${eventId})`, {
                traceId,
                routingKey,
                eventId,
              });
            }

            // Transform into SSE-compatible banking event
            const sseEvent = {
              id: eventId,
              eventId,
              type: routingKey || eventType,
              eventType: routingKey || eventType,
              routingKey,
              traceId,
              transactionId:
                eventPayload.transactionId || content.transactionId || headers.transactionId,
              referenceId: eventPayload.referenceId || content.referenceId || headers.referenceId,
              amount: eventPayload.amount !== undefined ? Number(eventPayload.amount) : undefined,
              currency: eventPayload.currency || 'USD',
              sourceAccountNumber: eventPayload.sourceAccountNumber,
              targetAccountNumber: eventPayload.targetAccountNumber,
              recipient: eventPayload.recipient || eventPayload.email,
              payload: eventPayload,
              timestamp: content.timestamp || eventPayload.timestamp || new Date().toISOString(),
            };

            // Broadcast primary event to SSE clients
            broadcastSSEEvent(sseEvent);
            this.metrics.eventsBroadcasted++;
            this.metrics.lastEventAt = new Date().toISOString();

            // If it's a completed payment, also broadcast a notification.created event
            // so React RealtimeContext creates live notification alerts in the UI
            if (routingKey === 'payment.completed' || eventType === 'PAYMENT_COMPLETED') {
              const amountFormatted =
                sseEvent.amount !== undefined ? `${sseEvent.amount} ${sseEvent.currency}` : 'funds';
              const refFormatted = sseEvent.referenceId ? ` (Ref: ${sseEvent.referenceId})` : '';

              const liveNotificationEvent = {
                id: `notif-${eventId}`,
                eventId: `notif-${eventId}`,
                type: 'notification.created',
                eventType: 'notification.created',
                routingKey: 'notification.created',
                traceId,
                transactionId: sseEvent.transactionId,
                referenceId: sseEvent.referenceId,
                title: 'Payment Completed',
                subject: 'VaultCore Transfer Completed',
                message: `Your payment of ${amountFormatted}${refFormatted} was completed successfully.`,
                amount: sseEvent.amount,
                currency: sseEvent.currency,
                recipient: sseEvent.recipient,
                channel: 'EMAIL',
                status: 'SENT',
                read: false,
                timestamp: sseEvent.timestamp,
                payload: {
                  ...eventPayload,
                  subject: 'VaultCore Transfer Completed',
                  body: `Your payment of ${amountFormatted}${refFormatted} was completed successfully.`,
                },
              };

              broadcastSSEEvent(liveNotificationEvent);
              this.metrics.eventsBroadcasted++;
            }

            // Acknowledge the message
            this.channel.ack(msg);
          } catch (err) {
            this.metrics.errors++;
            if (this.logger) {
              this.logger.error(`[RabbitMQ] Error handling SSE message: ${err.message}`, {
                routingKey,
                error: err.message,
              });
            }
            // Acknowledge so bad messages don't block the stream
            this.channel.ack(msg);
          }
        },
        { noAck: false }
      );

      if (this.logger) {
        this.logger.info(
          '[RabbitMQ] GatewayEventConsumer successfully started and listening for real-time events'
        );
      }
    } catch (err) {
      if (this.logger) {
        this.logger.warn(
          `[RabbitMQ] Could not connect GatewayEventConsumer to RabbitMQ: ${err.message}. Retrying in background...`
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
        `[RabbitMQ] Scheduling reconnect attempt #${this.reconnectAttempts} in ${delay}ms`
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
      if (this.logger)
        this.logger.warn(`[RabbitMQ] Error during clean consumer shutdown: ${err.message}`);
    } finally {
      this.cleanup();
      if (this.logger) this.logger.info('[RabbitMQ] GatewayEventConsumer stopped gracefully');
    }
  }

  getMetrics() {
    return {
      isRunning: this.isRunning,
      queue: this.queue,
      exchange: this.exchange,
      ...this.metrics,
    };
  }
}
