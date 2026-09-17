import { OutboxRepository } from '../repositories/outboxRepository.js';
import { OutboxPublisher } from './outboxPublisher.js';

export class OutboxWorker {
  constructor(logger, options = {}) {
    this.logger = logger;
    this.repository = options.repository || new OutboxRepository();
    this.publisher = options.publisher || new OutboxPublisher(logger);
    this.pollIntervalMs = options.pollIntervalMs || 2000; // 2 seconds poll interval
    this.maxRetries = options.maxRetries || 5;
    this.batchSize = options.batchSize || 50;

    this.timer = null;
    this.isRunning = false;
    this.isStopped = false;
    this.isProcessing = false;

    // In-memory metrics tracker
    this.metrics = {
      pendingOutboxEvents: 0,
      publishedEvents: 0,
      failedEvents: 0,
      retryCount: 0,
      queuePublishLatencyMs: 0,
      lastProcessedAt: null,
      totalCycles: 0,
    };
  }

  /**
   * Start the background worker polling loop
   */
  async start(amqpUri) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isStopped = false;

    try {
      await this.publisher.init(amqpUri);
    } catch (err) {
      if (this.logger) {
        this.logger.warn(
          `OutboxWorker could not connect to RabbitMQ on startup: ${err.message}. Will retry during polling cycle.`
        );
      }
    }

    if (this.logger) {
      this.logger.info(
        `OutboxWorker started with poll interval ${this.pollIntervalMs}ms and max retries ${this.maxRetries}`
      );
    }

    // Run first batch immediately
    this.processBatch().catch((err) => {
      if (this.logger) this.logger.error(`Initial outbox processing error: ${err.message}`);
    });

    this.timer = setInterval(() => {
      if (this.isRunning && !this.isProcessing) {
        this.processBatch().catch((err) => {
          if (this.logger) this.logger.error(`Error in outbox poll cycle: ${err.message}`);
        });
      }
    }, this.pollIntervalMs);
  }

  /**
   * Stop the background worker
   */
  async stop() {
    this.isRunning = false;
    this.isStopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.publisher.close();
    if (this.logger) {
      this.logger.info('OutboxWorker stopped gracefully');
    }
  }

  /**
   * Calculate exponential backoff delay in milliseconds
   */
  calculateBackoffMs(retryCount) {
    return Math.min(1000 * Math.pow(2, retryCount), 30000);
  }

  /**
   * Process a single batch of pending outbox events
   */
  async processBatch() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.metrics.totalCycles += 1;

    try {
      const pendingEvents = await this.repository.fetchPendingEvents(this.batchSize);
      this.metrics.pendingOutboxEvents = pendingEvents.length;

      if (pendingEvents.length === 0) {
        this.isProcessing = false;
        return;
      }

      for (const event of pendingEvents) {
        if (this.isStopped) break;

        // Idempotency check: if event is already marked PUBLISHED, skip it
        if (event.status === 'PUBLISHED') {
          continue;
        }

        const payload =
          typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload || {};

        const traceId = payload.traceId || `trace-${event.id}`;
        const transactionId = event.transactionId || event.aggregateId || payload.transactionId;
        const routingKey =
          payload.routingKey ||
          (event.eventType === 'PAYMENT_FAILED' ? 'payment.failed' : 'payment.completed');
        const currentRetry = event.retryCount || 0;

        // Exponential backoff check: if event failed previously, ensure sufficient time has elapsed
        if (currentRetry > 0) {
          const requiredDelay = this.calculateBackoffMs(currentRetry - 1);
          const timeSinceLastUpdate = Date.now() - new Date(event.updatedAt).getTime();
          if (timeSinceLastUpdate < requiredDelay) {
            // Not ready for retry yet, skip this event for this cycle
            continue;
          }
        }

        try {
          // Attempt to publish to RabbitMQ
          const { latencyMs } = await this.publisher.publish(event, traceId);

          // Update metrics
          this.metrics.queuePublishLatencyMs = latencyMs;
          this.metrics.publishedEvents += 1;
          this.metrics.lastProcessedAt = new Date().toISOString();

          // Mark as PUBLISHED in database
          await this.repository.markEventPublished(event.id);

          if (this.logger) {
            this.logger.info(`Outbox event published successfully [${routingKey}]`, {
              traceId,
              eventId: event.id,
              transactionId,
              routingKey,
              retryAttempt: currentRetry,
              latencyMs,
            });
          }
        } catch (publishError) {
          const nextRetry = currentRetry + 1;
          this.metrics.retryCount += 1;

          if (nextRetry >= this.maxRetries) {
            // Reached maximum retries -> mark as FAILED
            await this.repository.markEventFailed(event.id, publishError.message, nextRetry);
            this.metrics.failedEvents += 1;

            if (this.logger) {
              this.logger.error(`Outbox event failed permanently after ${nextRetry} retries`, {
                traceId,
                eventId: event.id,
                transactionId,
                routingKey,
                retryAttempt: nextRetry,
                error: publishError.message,
              });
            }
          } else {
            // Increment retry count and store error for exponential backoff
            await this.repository.incrementRetry(event.id, publishError.message, nextRetry);

            if (this.logger) {
              this.logger.warn(
                `Outbox event publish failed, scheduled for retry (attempt ${nextRetry}/${this.maxRetries})`,
                {
                  traceId,
                  eventId: event.id,
                  transactionId,
                  routingKey,
                  retryAttempt: nextRetry,
                  error: publishError.message,
                }
              );
            }
          }
        }
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error(`OutboxWorker batch processing error: ${error.message}`);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get current worker status and metrics
   */
  async getStatus() {
    const dbStatus = await this.repository.getOutboxStatus();
    return {
      worker: {
        isRunning: this.isRunning,
        pollIntervalMs: this.pollIntervalMs,
        maxRetries: this.maxRetries,
        metrics: this.metrics,
      },
      outboxDatabase: dbStatus,
    };
  }
}
