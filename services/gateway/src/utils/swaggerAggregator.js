import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const buildAggregatedSwaggerSpec = () => {
  let rootDir = path.resolve(__dirname, '../../../../');
  if (!fs.existsSync(path.join(rootDir, 'services'))) {
    rootDir = path.resolve(__dirname, '../../../');
  }
  if (!fs.existsSync(path.join(rootDir, 'services'))) {
    rootDir = process.cwd();
  }
  
  const serviceSpecPaths = [
    { service: 'auth', prefix: '/api/v1/auth', file: path.join(rootDir, 'services/auth-service/src/swagger.json'), tag: 'Authentication' },
    { service: 'account', prefix: '/api/v1/accounts', file: path.join(rootDir, 'services/account-service/src/swagger.json'), tag: 'Accounts & Balances' },
    { service: 'payment', prefix: '/api/v1/payments', file: path.join(rootDir, 'services/payment-service/src/swagger.json'), tag: 'Payment Orchestration' },
    { service: 'ledger', prefix: '/api/v1/ledger', file: path.join(rootDir, 'services/ledger-service/src/swagger.json'), tag: 'Immutable Ledger' },
    { service: 'notification', prefix: '/api/v1/notifications', file: path.join(rootDir, 'services/notification-service/src/swagger.json'), tag: 'Notifications & Alerts' },
  ];

  const aggregatedSpec = {
    openapi: '3.0.0',
    info: {
      title: 'VaultCore Unified Distributed Banking API',
      version: '1.0.0',
      description: 'Comprehensive unified OpenAPI documentation for VaultCore API Gateway aggregating Auth, Account, Payment, Ledger, and Notification microservices.',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'VaultCore API Gateway',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {},
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Gateway', description: 'API Gateway Health, Readiness & Metrics' },
      { name: 'Authentication', description: 'User Registration, Login, Token Refresh & Revocation' },
      { name: 'Accounts & Balances', description: 'Bank Account Management & Balances' },
      { name: 'Payment Orchestration', description: 'Money Transfers, Outbox Events & History' },
      { name: 'Immutable Ledger', description: 'Double-Entry Bookkeeping & Audit Entries' },
      { name: 'Notifications & Alerts', description: 'Email/SMS Notification Logs & Queue Status' },
    ],
    paths: {
      '/health': {
        get: {
          summary: 'Gateway Health Overview',
          tags: ['Gateway'],
          security: [],
          responses: {
            200: { description: 'Gateway status and downstream service mapping' },
          },
        },
      },
      '/health/live': {
        get: {
          summary: 'Gateway Liveness Probe',
          tags: ['Gateway'],
          security: [],
          responses: {
            200: { description: 'Gateway process is alive' },
          },
        },
      },
      '/health/ready': {
        get: {
          summary: 'Gateway Readiness Probe',
          tags: ['Gateway'],
          security: [],
          responses: {
            200: { description: 'All database, redis, and messaging dependencies are ready' },
            503: { description: 'One or more dependencies are down' },
          },
        },
      },
      '/metrics': {
        get: {
          summary: 'Prometheus Metrics Exposition',
          tags: ['Gateway'],
          security: [],
          responses: {
            200: { description: 'Prometheus metric output' },
          },
        },
      },
    },
  };

  // Merge each microservice specification
  for (const item of serviceSpecPaths) {
    try {
      if (fs.existsSync(item.file)) {
        const rawContent = fs.readFileSync(item.file, 'utf-8');
        const spec = JSON.parse(rawContent);

        // Merge Schemas
        if (spec.components && spec.components.schemas) {
          Object.assign(aggregatedSpec.components.schemas, spec.components.schemas);
        }

        // Merge Paths with service prefix
        if (spec.paths) {
          for (const [routePath, methods] of Object.entries(spec.paths)) {
            // Ignore individual service health in main list or prefix under service
            if (routePath === '/health') {
              aggregatedSpec.paths[`${item.prefix}/health`] = {
                get: {
                  summary: `${item.tag} Health Check`,
                  tags: [item.tag],
                  security: [],
                  responses: { 200: { description: `${item.service} service is healthy` } },
                },
              };
              continue;
            }

            const cleanPath = routePath.startsWith('/') ? routePath : `/${routePath}`;
            let fullGatewayPath = `${item.prefix}${cleanPath}`.replace(/\/+/g, '/');

            // Handle root slash or special sub-paths (e.g. outbox routes in payment service)
            if (cleanPath === '/status' && item.service === 'payment') {
              fullGatewayPath = '/api/v1/outbox/status';
            }

            // Tag each operation with the service name
            const taggedMethods = {};
            for (const [method, op] of Object.entries(methods)) {
              taggedMethods[method] = {
                ...op,
                tags: op.tags && op.tags.length > 0 ? op.tags : [item.tag],
              };
            }

            aggregatedSpec.paths[fullGatewayPath] = taggedMethods;
          }
        }
      }
    } catch (error) {
      console.warn(`[SwaggerAggregator] Could not load spec for ${item.service}: ${error.message}`);
    }
  }

  return aggregatedSpec;
};
