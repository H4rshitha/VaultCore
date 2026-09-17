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
  createServiceMetricsMiddleware,
  metricsEndpointHandler,
} from '@vaultcore/shared';
import ledgerRoutes from './routes/ledgerRoutes.js';
import swaggerDocument from './swagger.json' with { type: 'json' };

const logger = createLogger('ledger-service');
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
app.use(createServiceMetricsMiddleware('ledger-service'));
app.use(requestLogger(logger));

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get('/metrics', metricsEndpointHandler);

app.get(['/health', '/health/live'], (req, res) => {
  return ApiResponse.success(res, 'Ledger Service is healthy', { status: 'UP' });
});

app.use('/', ledgerRoutes);

app.use(errorHandler(logger));

export { app, logger };
