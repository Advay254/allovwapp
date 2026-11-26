import type { FastifyInstance } from 'fastify';
import { APP_VERSION } from '@allov/shared';
import { ensureOwnerAccount } from './auth/auth-owner.js';
import { warmPasswordHashing } from './auth/auth-password.js';
import { ConfigError, loadConfig } from './config/index.js';
import { Database } from './db/connection.js';
import { startApi } from './entry-api.js';
import { startWorker } from './entry-worker.js';
import type { AppContext } from './lib/context.js';
import { createLogger, describeError } from './lib/log.js';

async function main(): Promise<void> {
  let loaded: ReturnType<typeof loadConfig>;
  try {
    loaded = loadConfig(process.env);
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(`AllovWapp cannot start. ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
  const { config, warnings } = loaded;

  const logger = createLogger(config.logLevel);
  // Start up lines always print, whatever LOG_LEVEL is, because the documentation relies on them.
  const lifecycle = logger.child({ scope: 'lifecycle' }, { level: 'info' });
  for (const warning of warnings) logger.warn({ scope: 'config' }, warning);

  const database = new Database(config, logger, lifecycle);
  const ctx: AppContext = { config, configWarnings: warnings, logger, lifecycle, database };

  const runsApi = config.role !== 'worker';
  const runsWorker = config.role !== 'api';

  let app: FastifyInstance | null = null;
  if (runsApi) {
    app = await startApi(ctx);
  } else {
    lifecycle.info(`AllovWapp ${APP_VERSION} worker running`);
    // A worker only process has no server socket, so keep the event loop alive.
    setInterval(() => undefined, 60 * 60 * 1000);
  }
  const worker = runsWorker ? startWorker(ctx) : null;

  void warmPasswordHashing().catch(() => undefined);
  if (runsApi) database.onReady(() => ensureOwnerAccount(ctx));

  // The server is already listening. The database connects in the background.
  database.start().catch((err: unknown) => {
    logger.fatal({ err: describeError(err) }, 'Start up stopped because of a database problem');
    process.exit(1);
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    lifecycle.info(`Received ${signal}, shutting down`);
    const force = setTimeout(() => process.exit(1), 15_000);
    force.unref();
    try {
      if (app) await app.close();
      if (worker) await worker.stop();
      await database.close();
    } catch (err) {
      logger.error({ err: describeError(err) }, 'Error during shut down');
    }
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  console.error('AllovWapp failed to start.', describeError(err));
  process.exit(1);
});
