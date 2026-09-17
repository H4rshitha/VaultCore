import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { createLogger, errorHandler, requestLogger, traceMiddleware, ApiResponse } from '@vaultcore/shared';
import authRoutes from './routes/authRoutes.js';
import swaggerDocument from './swagger.json' with { type: 'json' };

const logger = createLogger('auth-service');
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
  return ApiResponse.success(res, 'Auth Service is healthy', { status: 'UP' });
});

app.use('/', authRoutes);

app.use(errorHandler(logger));

export { app, logger };
