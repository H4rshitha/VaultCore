import amqp from 'amqplib';

export class RabbitMQClient {
  constructor(logger) {
    this.logger = logger;
    this.connection = null;
    this.channel = null;
    this.isConnecting = false;
  }

  async connect(uri) {
    if (this.channel) return;
    const amqpUri = uri || process.env.RABBITMQ_URI || `amqp://${process.env.RABBITMQ_HOST || 'localhost'}:${process.env.RABBITMQ_PORT || 5672}`;
    try {
      this.isConnecting = true;
      this.connection = await amqp.connect(amqpUri);
      this.channel = await this.connection.createChannel();
      this.isConnecting = false;
      if (this.logger) this.logger.info(`Connected to RabbitMQ at ${amqpUri}`);

      this.connection.on('error', (err) => {
        if (this.logger) this.logger.error(`RabbitMQ connection error: ${err.message}`);
        this.channel = null;
        this.connection = null;
      });

      this.connection.on('close', () => {
        if (this.logger) this.logger.warn('RabbitMQ connection closed');
        this.channel = null;
        this.connection = null;
      });
    } catch (error) {
      this.isConnecting = false;
      this.channel = null;
      this.connection = null;
      if (this.logger) this.logger.error(`Failed to connect to RabbitMQ: ${error.message}`);
      throw error;
    }
  }

  async setupTopology(exchange = 'vaultcore.events', exchangeType = 'topic') {
    if (!this.channel) {
      await this.connect();
    }
    // Assert durable topic exchange
    await this.channel.assertExchange(exchange, exchangeType, { durable: true });

    // Declare queues and bindings in code
    const queueBindings = [
      {
        queue: 'vaultcore.payments.queue',
        routingKeys: ['payment.completed', 'payment.failed', 'payment.reversed'],
      },
      {
        queue: 'vaultcore.notifications.email.queue',
        routingKeys: ['notification.email', 'payment.completed', 'payment.failed'],
      },
      {
        queue: 'vaultcore.notifications.sms.queue',
        routingKeys: ['notification.sms'],
      },
    ];

    for (const item of queueBindings) {
      await this.channel.assertQueue(item.queue, { durable: true });
      for (const routingKey of item.routingKeys) {
        await this.channel.bindQueue(item.queue, exchange, routingKey);
      }
    }

    if (this.logger) {
      this.logger.info(`RabbitMQ topology initialized for exchange [${exchange}]`);
    }
  }

  async publishEvent(exchange, routingKey, data, options = {}) {
    if (!this.channel) {
      await this.connect();
    }
    await this.channel.assertExchange(exchange, 'topic', { durable: true });
    const payload = Buffer.from(JSON.stringify(data));
    const publishOptions = {
      persistent: true,
      contentType: 'application/json',
      timestamp: Date.now(),
      headers: options.headers || {},
      ...options,
    };

    const published = this.channel.publish(exchange, routingKey, payload, publishOptions);
    if (!published) {
      throw new Error(`RabbitMQ buffer full, failed to publish to exchange [${exchange}] with key [${routingKey}]`);
    }
    return published;
  }

  async consumeQueue(queueName, exchange, routingKey, handler) {
    if (!this.channel) {
      await this.connect();
    }
    await this.channel.assertExchange(exchange, 'topic', { durable: true });
    await this.channel.assertQueue(queueName, { durable: true });
    await this.channel.bindQueue(queueName, exchange, routingKey);

    if (this.logger) this.logger.info(`Listening on queue: ${queueName} with key: ${routingKey}`);

    this.channel.consume(queueName, async (msg) => {
      if (msg !== null) {
        try {
          const content = JSON.parse(msg.content.toString());
          await handler(content, msg);
          this.channel.ack(msg);
        } catch (error) {
          if (this.logger) this.logger.error(`Error processing message: ${error.message}`);
          this.channel.nack(msg, false, false);
        }
      }
    });
  }

  async close() {
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
    } catch (err) {
      if (this.logger) this.logger.warn(`Error closing RabbitMQ connection: ${err.message}`);
    } finally {
      this.channel = null;
      this.connection = null;
    }
  }
}
