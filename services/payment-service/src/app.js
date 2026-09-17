import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import {
  createLogger,
  errorHandler,
  requestLogger,
  traceMiddleware,
  ApiResponse,
  circuitBreakerRegistry,
  createServiceMetricsMiddleware,
  metricsEndpointHandler,
} from '@vaultcore/shared';
import fs from 'fs';
import paymentRoutes from './routes/paymentRoutes.js';
import outboxRoutes from './routes/outboxRoutes.js';

const swaggerDocument = JSON.parse(
  fs.readFileSync(new URL('./swagger.json', import.meta.url), 'utf8')
);

const logger = createLogger('payment-service');
const app = express();

app.use(helmet());
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());
app.use(traceMiddleware);
app.use(createServiceMetricsMiddleware('payment-service'));
app.use(requestLogger(logger));

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get('/metrics', metricsEndpointHandler);

app.get(['/health', '/health/live'], (req, res) => {
  return ApiResponse.success(res, 'Payment Service is healthy', { status: 'UP' });
});

app.get('/admin/circuit-breakers', (req, res) => {
  return ApiResponse.success(
    res,
    'Circuit breakers status retrieved successfully',
    circuitBreakerRegistry.getAllStatus()
  );
});

app.use('/api/v1/outbox', outboxRoutes);
app.use('/outbox', outboxRoutes);
app.use('/', paymentRoutes);

app.use(errorHandler(logger));

export { app, logger };
