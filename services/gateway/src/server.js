import { app, logger } from './app.js';
import { config } from './config/index.js';
import { GatewayEventConsumer } from './services/gatewayEventConsumer.js';

const eventConsumer = new GatewayEventConsumer(logger, {
  uri: config.rabbitmqUri,
});

const server = app.listen(config.port, async () => {
  logger.info(`VaultCore API Gateway running on port ${config.port} in ${config.nodeEnv} mode`);
  logger.info(`API Documentation available at http://localhost:${config.port}/docs`);

  // Start background RabbitMQ consumer for SSE events
  try {
    await eventConsumer.start();
  } catch (err) {
    logger.warn(`[RabbitMQ] GatewayEventConsumer will retry connecting: ${err.message}`);
  }
});

const gracefulShutdown = async () => {
  logger.info('Received shutdown signal, closing API Gateway gracefully...');
  try {
    await eventConsumer.stop();
  } catch (err) {
    logger.warn(`Error stopping GatewayEventConsumer: ${err.message}`);
  }
  server.close(() => {
    logger.info('API Gateway closed successfully.');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
