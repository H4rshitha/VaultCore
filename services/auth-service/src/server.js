import { app, logger } from './app.js';
import { config } from './config/index.js';

const server = app.listen(config.port, () => {
  logger.info(`Auth Service running on port ${config.port} in ${config.nodeEnv} mode`);
});

const gracefulShutdown = () => {
  logger.info('Received shutdown signal, shutting down Auth Service...');
  server.close(() => {
    logger.info('Auth Service shut down cleanly.');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
