import net from 'net';
import http from 'http';
import Redis from 'ioredis';
import amqp from 'amqplib';
import { config } from '../config/index.js';

const parsePgConfig = () => {
  if (config.databaseUrl || process.env.DATABASE_URL) {
    try {
      const u = new URL(config.databaseUrl || process.env.DATABASE_URL);
      return { host: u.hostname || 'postgres', port: parseInt(u.port || '5432', 10) };
    } catch {
      // ignore
    }
  }
  return {
    host: process.env.DB_HOST || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432', 10),
  };
};

const checkTcp = (host, port, timeoutMs = 2000) => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isResolved = false;

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve({ status: 'UP', latencyMs: 5 });
      }
    });

    socket.on('timeout', () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve({ status: 'DOWN', error: 'Connection timeout' });
      }
    });

    socket.on('error', (err) => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve({ status: 'DOWN', error: err.message });
      }
    });

    socket.connect(port, host);
  });
};

const checkMicroserviceLive = async (serviceName, baseUrl, timeoutMs = 2000) => {
  const startTime = Date.now();
  const url = `${baseUrl}/health/live`;
  const fallbackUrl = `${baseUrl}/health`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let res = null;
    try {
      res = await fetch(url, { signal: controller.signal });
      if (!res || !res.ok) {
        res = await fetch(fallbackUrl, { signal: controller.signal });
      }
    } catch (e) {
      try {
        res = await fetch(fallbackUrl, { signal: controller.signal });
      } catch (err) {
        // Both endpoints failed
      }
    } finally {
      clearTimeout(timeoutId);
    }

    const latencyMs = Date.now() - startTime;
    return {
      status: res && res.ok ? 'UP' : 'DOWN',
      statusCode: res ? res.status : 500,
      latencyMs,
      endpoint: res && res.ok ? res.url || url : url,
    };
  } catch (error) {
    return {
      status: 'DOWN',
      error: error.message,
      latencyMs: Date.now() - startTime,
      endpoint: url,
    };
  }
};

export class HealthChecker {
  /**
   * Verify PostgreSQL connectivity
   */
  static async checkPostgres() {
    const startTime = Date.now();
    try {
      const { host, port } = parsePgConfig();
      return await checkTcp(host, port);
    } catch (error) {
      return { status: 'DOWN', error: error.message, latencyMs: Date.now() - startTime };
    }
  }

  /**
   * Verify Redis connectivity
   */
  static async checkRedis() {
    const startTime = Date.now();
    try {
      const redis = new Redis({
        host: config.redisHost,
        port: config.redisPort,
        connectTimeout: 2000,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });
      await redis.connect();
      const pong = await redis.ping();
      await redis.quit();
      return { status: pong === 'PONG' ? 'UP' : 'DOWN', latencyMs: Date.now() - startTime };
    } catch (error) {
      return { status: 'DOWN', error: error.message, latencyMs: Date.now() - startTime };
    }
  }

  /**
   * Verify RabbitMQ connectivity
   */
  static async checkRabbitMQ() {
    const startTime = Date.now();
    try {
      const conn = await amqp.connect(config.rabbitmqUri, { timeout: 2000 });
      await conn.close();
      return { status: 'UP', latencyMs: Date.now() - startTime };
    } catch (error) {
      return { status: 'DOWN', error: error.message, latencyMs: Date.now() - startTime };
    }
  }

  /**
   * Enhanced Readiness probe checking PostgreSQL, Redis, RabbitMQ, and all 5 microservices
   */
  static async getReadiness() {
    const [postgres, redis, rabbitmq, auth, account, payment, ledger, notification] =
      await Promise.all([
        HealthChecker.checkPostgres(),
        HealthChecker.checkRedis(),
        HealthChecker.checkRabbitMQ(),
        checkMicroserviceLive('auth', config.services.auth),
        checkMicroserviceLive('account', config.services.account),
        checkMicroserviceLive('payment', config.services.payment),
        checkMicroserviceLive('ledger', config.services.ledger),
        checkMicroserviceLive('notification', config.services.notification),
      ]);

    const infraHealthy =
      postgres.status === 'UP' && redis.status === 'UP' && rabbitmq.status === 'UP';
    const isReady = infraHealthy;

    return {
      status: isReady ? 'READY' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      infrastructure: {
        postgres,
        redis,
        rabbitmq,
      },
      microservices: {
        auth,
        account,
        payment,
        ledger,
        notification,
      },
    };
  }

  /**
   * Basic liveness probe
   */
  static getLiveness() {
    return {
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      memoryUsage: process.memoryUsage(),
    };
  }

  /**
   * Gateway health overview
   */
  static getGatewayOverview() {
    return {
      status: 'UP',
      service: 'api-gateway',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      downstreamServices: config.services,
      timeouts: config.timeouts,
    };
  }
}
