import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { createLogger, errorHandler, requestLogger, traceMiddleware, ApiResponse } from '@vaultcore/shared';
import accountRoutes from './routes/accountRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import swaggerDocument from './swagger.json' with { type: 'json' };

const logger = createLogger('account-service');
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
app.use(requestLogger(logger));

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get(['/health', '/health/live'], (req, res) => {
  return ApiResponse.success(res, 'Account Service is healthy', { status: 'UP' });
});

app.use('/customers', customerRoutes);
app.use('/accounts', accountRoutes);
app.use('/', accountRoutes);

app.use(errorHandler(logger));

export { app, logger };
