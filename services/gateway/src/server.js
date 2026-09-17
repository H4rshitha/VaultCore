import { app, logger } from './app.js';
import { config } from './config/index.js';

const server = app.listen(config.port, () => {
  logger.info(`VaultCore API Gateway running on port ${config.port} in ${config.nodeEnv} mode`);
  logger.info(`API Documentation available at http://localhost:${config.port}/docs`);
});

const gracefulShutdown = () => {
  logger.info('Received shutdown signal, closing API Gateway gracefully...');
  server.close(() => {
    logger.info('API Gateway closed successfully.');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
