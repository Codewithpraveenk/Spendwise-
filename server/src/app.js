import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { HttpError } from './errors/HttpError.js';
import { requestContext } from './middleware/requestContext.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { createHealthRouter } from './routes/health.js';
import { createAuthRouter } from './routes/auth.js';
import { createFinanceRouter } from './routes/finance.js';
import { createWorkspaceRouter } from './routes/workspace.js';
import { mountFrontend } from './frontend.js';
import { fileURLToPath } from 'node:url';

export const consoleLogger = {
  info: (entry) => console.log(JSON.stringify(entry)),
  error: (entry) => console.error(JSON.stringify(entry)),
};

// Importing the app never starts a listener; tests can create isolated instances.
export function createApp({ config, logger = consoleLogger, database, googleVerifier, frontendDirectory = fileURLToPath(new URL('../../dist/', import.meta.url)) }) {
  const app = express();
  app.set('env', config.nodeEnv);
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy ?? false);
  app.use(requestContext(logger));
  app.use(helmet({ crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    contentSecurityPolicy: { directives: {
      scriptSrc: ["'self'", 'https://accounts.google.com/gsi/client'],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com/gsi/style'],
      connectSrc: ["'self'", 'https://accounts.google.com/gsi/'],
      frameSrc: ['https://accounts.google.com/gsi/'],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: config.nodeEnv === 'production' ? [] : null,
    } },
  }));
  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.clientOrigins.includes(origin)) callback(null, true);
      else callback(new HttpError(403, 'ORIGIN_NOT_ALLOWED', 'This browser origin is not allowed.'));
    },
    exposedHeaders: ['X-Request-Id'],
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  }));
  app.use('/api/workspace', createWorkspaceRouter({ config, database }));
  app.use(express.json({ limit: '100kb' }));
  app.use('/api/health', createHealthRouter());
  app.use('/api/auth', createAuthRouter({ config, database, googleVerifier }));
  app.use('/api/finance', createFinanceRouter({ config, database }));
  app.get('/api/ready', async (_req, res) => {
    const ready = database ? await database.isReady() : false;
    res.set('Cache-Control', 'no-store').status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready', database: ready ? 'connected' : 'unavailable',
    });
  });
  app.use('/api', notFound);
  if (config.serveFrontend) mountFrontend(app, frontendDirectory);
  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}
