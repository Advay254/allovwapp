import type { FastifyInstance } from 'fastify';
import { APP_VERSION } from '@allov/shared';
import { buildApp } from './http/app.js';
import type { AppContext } from './lib/context.js';

/** API role: builds the HTTP server and starts listening at once, without waiting for the database. */
export async function startApi(ctx: AppContext): Promise<FastifyInstance> {
  const app = await buildApp(ctx);
  await app.listen({ port: ctx.config.port, host: '0.0.0.0' });
  ctx.lifecycle.info(`AllovWapp ${APP_VERSION} listening on port ${ctx.config.port}`);
  return app;
}
