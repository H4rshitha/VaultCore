import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port:
    process.env.NOTIFICATION_SERVICE_PORT ||
    (process.env.PORT && process.env.PORT !== '3000' ? parseInt(process.env.PORT, 10) : 3005),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'super-secret-vaultcore-jwt-key-2026',
  rabbitmqUri:
    process.env.RABBITMQ_URI ||
    `amqp://${process.env.RABBITMQ_HOST || 'localhost'}:${process.env.RABBITMQ_PORT || 5672}`,
  rabbitmqHost: process.env.RABBITMQ_HOST || 'localhost',
  rabbitmqPort: process.env.RABBITMQ_PORT || 5672,
  exchange: process.env.RABBITMQ_EXCHANGE || 'vaultcore.events',
  emailQueue: 'vaultcore.notifications.email.queue',
  smsQueue: 'vaultcore.notifications.sms.queue',
  dlqQueue: 'vaultcore.notifications.dlq',
  maxRetries: 3,
};
