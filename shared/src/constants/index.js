export const ACCOUNT_TYPES = {
  SAVINGS: 'SAVINGS',
  CHECKING: 'CHECKING',
  INVESTMENT: 'INVESTMENT',
  LOAN: 'LOAN',
};

export const ACCOUNT_STATUS = {
  ACTIVE: 'ACTIVE',
  FROZEN: 'FROZEN',
  CLOSED: 'CLOSED',
};

export const TRANSACTION_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REVERSED: 'REVERSED',
};

export const TRANSACTION_TYPES = {
  DEPOSIT: 'DEPOSIT',
  WITHDRAWAL: 'WITHDRAWAL',
  TRANSFER: 'TRANSFER',
};

export const LEDGER_ENTRY_TYPES = {
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
};

export const EVENT_EXCHANGES = {
  BANKING_EVENTS: 'vaultcore.events',
};

export const EVENT_ROUTING_KEYS = {
  PAYMENT_INITIATED: 'payment.initiated',
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_REVERSED: 'payment.reversed',
  NOTIFICATION_EMAIL: 'notification.email',
  NOTIFICATION_SMS: 'notification.sms',
  ACCOUNT_CREATED: 'account.created',
};

export const USER_ROLES = {
  CUSTOMER: 'CUSTOMER',
  TELLER: 'TELLER',
  ADMIN: 'ADMIN',
};

export const REDIS_DATABASES = {
  RATE_LIMIT: 0,
  ACCOUNT_CACHE: 1,
  DISTRIBUTED_LOCKS: 2,
  REFRESH_TOKENS: 3,
};

export const CACHE_TTL = {
  ACCOUNT_BALANCE: 30, // 30 seconds
  ACCOUNT_DETAILS: 300, // 5 minutes
};

export const LOCK_CONSTANTS = {
  LOCK_EXPIRATION_MS: 10000, // 10 seconds
  IDEMPOTENCY_TTL_SECONDS: 86400, // 24 hours
};

export const NOTIFICATION_TYPES = {
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  PUSH: 'PUSH',
};

export const NOTIFICATION_STATUS = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
  DELIVERED: 'DELIVERED',
};

export const NOTIFICATION_QUEUES = {
  EMAIL: 'vaultcore.notifications.email.queue',
  SMS: 'vaultcore.notifications.sms.queue',
  DLQ: 'vaultcore.notifications.dlq',
  EXCHANGE: 'vaultcore.events',
};

export const RATE_LIMIT_CONFIG = {
  AUTH: {
    LIMIT: 10,
    WINDOW_SECONDS: 60,
    DESCRIPTION: '10 requests per minute per IP for Auth endpoints',
  },
  PAYMENT: {
    LIMIT: 25, // 20 sustained + 5 burst allowance (up to 25 immediate requests before blocking)
    SUSTAINED_LIMIT: 20,
    BURST: 5,
    WINDOW_SECONDS: 60,
    DESCRIPTION:
      '20 sustained + 5 burst (total 25) requests per minute per authenticated user for Payment endpoints',
  },
  GENERAL: {
    LIMIT: 100,
    WINDOW_SECONDS: 60,
    DESCRIPTION: '100 requests per minute per user for General endpoints',
  },
};

export const CIRCUIT_STATES = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
};

export const CIRCUIT_BREAKER_CONFIG = {
  FAILURE_THRESHOLD: 5,
  SUCCESS_THRESHOLD: 3,
  OPEN_TIMEOUT_MS: 30000, // 30 seconds
  SERVICES: {
    LEDGER: 'ledger-service',
    RABBITMQ: 'rabbitmq-publisher',
    NOTIFICATION: 'notification-service',
  },
};
