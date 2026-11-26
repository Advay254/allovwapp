import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { API_PREFIX, REQUEST_ID_HEADER } from '@allov/shared';
import { registerAuditRoutes } from '../audit/audit-routes.js';
import { registerAuthRoutes } from '../auth/auth-routes.js';
import { AppError } from '../lib/app-error.js';
import type { AppContext } from '../lib/context.js';
import { registerSystemRoutes } from '../system/system-routes.js';
import { registerWorkspaceRoutes } from '../workspaces/workspace-routes.js';
import { registerErrorHandling } from './error-handler.js';
import { registerPublicRoutes } from './public-routes.js';
import { applySecurityHeaders } from './security-headers.js';
import { createSpa, findWebDist } from './spa.js';

export interface BuildAppOptions {
  /** Folder holding the built dashboard. Defaults to web/dist. Null means not built. */
  webDist?: string | null;
}

export async function buildApp(
  ctx: AppContext,
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const webDist = options.webDist === undefined ? findWebDist() : options.webDist;
  const spa = createSpa(ctx.config, webDist);

  const app = Fastify({
    loggerInstance: ctx.logger,
    trustProxy: 1,
    bodyLimit: 1_048_576,
    // Ids are generated here and never taken from the client, so logs cannot be poisoned.
    genReqId: () => `req_${randomBytes(8).toString('hex')}`,
    requestIdLogLabel: 'requestId',
    forceCloseConnections: 'idle',
    ajv: { customOptions: { removeAdditional: false, coerceTypes: 'array', allErrors: false } },
  });

  app.decorateRequest('auth', null);
  await app.register(cookie);

  app.addHook('onRequest', async (request, reply) => {
    reply.header(REQUEST_ID_HEADER, request.id);
  });
  app.addHook('preParsing', async (request) => {
    const encoding = request.headers['content-encoding'];
    if (encoding && encoding.toLowerCase() !== 'identity') {
      throw new AppError('validation_failed', {
        statusCode: 415,
        message: 'Compressed request bodies are not accepted.',
      });
    }
  });
  app.addHook('onSend', async (request, reply, payload) => {
    applySecurityHeaders(reply, ctx.config, request.url);
    return payload;
  });

  registerErrorHandling(app);

  if (webDist) {
    await app.register(fastifyStatic, {
      root: join(webDist, 'assets'),
      prefix: '/assets/',
      dotfiles: 'deny',
      index: false,
      allowedPath: (path) => !path.endsWith('.map'),
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    });
  }

  registerPublicRoutes(app, ctx, spa, webDist);

  await app.register(
    async (api) => {
      await api.register(rateLimit, {
        max: 300,
        timeWindow: '1 minute',
        keyGenerator: (request) => request.ip,
        errorResponseBuilder: (_request, context) =>
          new AppError('rate_limited', {
            headers: { 'Retry-After': String(Math.max(1, Math.ceil(context.ttl / 1000))) },
          }),
      });
      api.addHook('onRequest', async () => {
        if (!ctx.database.isReady()) throw new AppError('database_unavailable');
      });
      registerAuthRoutes(api, ctx);
      registerWorkspaceRoutes(api, ctx);
      registerAuditRoutes(api, ctx);
      registerSystemRoutes(api, ctx);
    },
    { prefix: API_PREFIX },
  );

  app.setNotFoundHandler(async (request, reply) => {
    const path = request.url.split('?')[0] ?? '';
    if (path.startsWith('/api/') || path.startsWith('/assets/')) {
      return reply.status(404).type('application/json; charset=utf-8').send({
        error: {
          code: 'not_found',
          message: 'That item was not found.',
          requestId: request.id,
        },
      });
    }
    return reply
      .status(404)
      .type('text/html; charset=utf-8')
      .header('cache-control', 'no-store')
      .send(spa.notFound());
  });

  return app;
}
