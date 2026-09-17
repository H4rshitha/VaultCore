import {
  RabbitMQClient,
  EVENT_EXCHANGES,
  EVENT_ROUTING_KEYS,
  rabbitmqCircuitBreaker,
} from '@vaultcore/shared';

export class OutboxPublisher {
  constructor(logger) {
    this.logger = logger;
    this.client = new RabbitMQClient(logger);
    this.exchange = EVENT_EXCHANGES.BANKING_EVENTS || 'vaultcore.events';
    this.isInitialized = false;
  }

  /**
   * Initialize connection and topology
   */
  async init(uri) {
    if (this.isInitialized) return;
    try {
      await this.client.connect(uri);
      await this.client.setupTopology(this.exchange, 'topic');
      this.isInitialized = true;
      if (this.logger) {
        this.logger.info(`OutboxPublisher initialized for exchange: ${this.exchange}`);
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error(`OutboxPublisher initialization failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Publish an outbox event to RabbitMQ with Circuit Breaker protection
   * @param {Object} outboxEvent - Outbox event from database
   * @param {string} traceId - Optional correlation trace ID
   * @returns {Promise<{ success: boolean, latencyMs: number }>}
   */
  async publish(outboxEvent, traceId) {
    return await rabbitmqCircuitBreaker.execute(
      async () => {
        const startTime = Date.now();
        const eventPayload =
          typeof outboxEvent.payload === 'string'
            ? JSON.parse(outboxEvent.payload)
            : outboxEvent.payload || {};

        const routingKey =
          eventPayload.routingKey ||
          outboxEvent.routingKey ||
          (outboxEvent.eventType === 'PAYMENT_FAILED'
            ? EVENT_ROUTING_KEYS.PAYMENT_FAILED
            : EVENT_ROUTING_KEYS.PAYMENT_COMPLETED);

        const messageData = {
          eventId: outboxEvent.id,
          aggregateType: outboxEvent.aggregateType,
          aggregateId: outboxEvent.aggregateId,
          eventType: outboxEvent.eventType,
          routingKey,
          payload: eventPayload,
          createdAt: outboxEvent.createdAt,
          timestamp: new Date().toISOString(),
        };

        const headers = {
          traceId: traceId || eventPayload.traceId || `trace-${outboxEvent.id}`,
          eventId: outboxEvent.id,
          transactionId: outboxEvent.transactionId || outboxEvent.aggregateId,
          eventType: outboxEvent.eventType,
          routingKey,
          retryAttempt: outboxEvent.retryCount || 0,
        };

        await this.client.publishEvent(this.exchange, routingKey, messageData, {
          messageId: outboxEvent.id,
          correlationId: headers.traceId,
          headers,
        });

        const latencyMs = Date.now() - startTime;
        return { success: true, latencyMs };
      },
      { traceId }
    );
  }

  async close() {
    this.isInitialized = false;
    await this.client.close();
  }
}
