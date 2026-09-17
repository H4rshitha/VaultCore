import { app, logger } from './app.js';
import { config } from './config/index.js';
import { OutboxWorker } from './services/outboxWorker.js';

const outboxWorker = new OutboxWorker(logger, {
  pollIntervalMs: 2000,
  maxRetries: 5,
});

const server = app.listen(config.port, async () => {
  logger.info(`Payment Service running on port ${config.port} in ${config.nodeEnv} mode`);
  
  // Start the background outbox worker
  try {
    await outboxWorker.start();
  } catch (err) {
    logger.error(`Failed to start OutboxWorker: ${err.message}`);
  }
});

const gracefulShutdown = async () => {
  logger.info('Received shutdown signal, shutting down Payment Service...');
  try {
    await outboxWorker.stop();
  } catch (err) {
    logger.warn(`Error stopping OutboxWorker: ${err.message}`);
  }
  server.close(() => {
    logger.info('Payment Service shut down cleanly.');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
