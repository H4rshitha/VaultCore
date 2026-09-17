import { app, logger } from './app.js';
import { config } from './config/index.js';
import { NotificationConsumer } from './services/notificationConsumer.js';

const consumer = new NotificationConsumer(logger);

const server = app.listen(config.port, async () => {
  logger.info(`Notification Service running on port ${config.port} in ${config.nodeEnv} mode`);

  try {
    await consumer.start();
  } catch (error) {
    logger.warn(`NotificationConsumer startup connection deferred: ${error.message}`);
  }
});

const gracefulShutdown = async () => {
  logger.info('Received shutdown signal, shutting down Notification Service...');
  try {
    await consumer.stop();
  } catch (err) {
    logger.warn(`Error stopping NotificationConsumer: ${err.message}`);
  }

  server.close(() => {
    logger.info('Notification Service shut down cleanly.');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
