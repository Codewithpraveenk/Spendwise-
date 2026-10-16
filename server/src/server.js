import { createApp, consoleLogger } from './app.js';
import { loadConfig } from './config/env.js';
import { connectDatabase } from './database.js';
import { startMailWorker } from './mail/delivery.js';

let config;
try { config = loadConfig(); }
catch (error) {
  consoleLogger.error({ event: 'configuration_error', message: error.message });
  process.exit(1);
}

let database;
if (config.mongodbUri) {
  try {
    database = await connectDatabase(config.mongodbUri, { autoIndex: config.nodeEnv !== 'production' });
    consoleLogger.info({ event: 'database_connected' });
  } catch {
    consoleLogger.error({ event: 'database_connection_failed', message: 'Check MONGODB_URI and database availability. Connection details are omitted to protect credentials.' });
    process.exit(1);
  }
} else {
  consoleLogger.info({ event: 'database_not_configured', message: 'Set MONGODB_URI to enable database readiness.' });
}

let app;
try { app = createApp({ config, database }); }
catch {
  consoleLogger.error({ event: 'startup_failed', message: 'Could not configure the application. Build the frontend before enabling SERVE_FRONTEND.' });
  await database?.close();
  process.exit(1);
}
const server = app.listen(config.port, config.host, () => {
  consoleLogger.info({ event: 'server_started', host: config.host, port: config.port, environment: config.nodeEnv });
});
const stopMailWorker = startMailWorker({ config, database, logger: consoleLogger });
if ((config.smtp || config.brevo) && database) consoleLogger.info({ event: 'mail_worker_started' });
server.requestTimeout = 30000;
server.headersTimeout = 10000;
server.keepAliveTimeout = 5000;
server.once('error', async (error) => {
  stopMailWorker();
  consoleLogger.error({ event: 'startup_failed', code: error.code ?? 'UNKNOWN', message: error.code === 'EADDRINUSE' ? 'The port is already in use. Choose another PORT.' : 'The server could not start.' });
  process.exitCode = 1;
  await database?.close();
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  stopMailWorker();
  consoleLogger.info({ event: 'server_stopping', signal });
  const force = setTimeout(() => {
    server.closeAllConnections();
    process.exit(1);
  }, 10000);
  force.unref();
  server.close(async (error) => {
    try { await database?.close(); }
    catch { error = error ?? new Error('Database shutdown failed.'); }
    clearTimeout(force);
    process.exitCode = error ? 1 : 0;
  });
}
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
