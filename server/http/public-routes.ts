import type { FastifyInstance } from 'fastify';
import { APP_VERSION, DASHBOARD_PATHS } from '@allov/shared';
import type { AppContext } from '../lib/context.js';
import type { Spa } from './spa.js';

const PUBLIC_FILES = ['favicon.svg', 'logo.svg', 'logo-symbol.svg', 'logo-white.svg', 'logo-dark.svg'];

export function registerPublicRoutes(
  app: FastifyInstance,
  ctx: AppContext,
  spa: Spa,
  webDist: string | null,
): void {
  const { config } = ctx;

  // Always 200 while the process is alive, so a deploy goes green even with a slow database.
  app.get('/health', async () => {
    const state = ctx.database.state;
    return {
      status: 'ok',
      version: APP_VERSION,
      database: state.status,
      ...(state.status === 'error' && state.reason ? { databaseReason: state.reason } : {}),
    };
  });

  app.get('/robots.txt', async (_request, reply) => {
    // The dashboard path is never listed here. It is protected by sign in, not by secrecy.
    return reply
      .type('text/plain; charset=utf-8')
      .header('cache-control', 'public, max-age=3600')
      .send(`User-agent: *\nAllow: /\n\nSitemap: ${config.baseUrl}/sitemap.xml\n`);
  });

  app.get('/sitemap.xml', async (_request, reply) => {
    return reply
      .type('application/xml; charset=utf-8')
      .header('cache-control', 'public, max-age=3600')
      .send(
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          `  <url><loc>${config.baseUrl}/</loc></url>\n` +
          '</urlset>\n',
      );
  });

  app.get('/', async (_request, reply) => {
    return reply
      .type('text/html; charset=utf-8')
      .header('cache-control', 'public, max-age=300')
      .send(spa.publicPage());
  });

  const serveDashboard = async (_request: unknown, reply: import('fastify').FastifyReply) =>
    reply
      .type('text/html; charset=utf-8')
      .header('cache-control', 'no-store')
      .send(spa.dashboard());
  for (const sub of DASHBOARD_PATHS) {
    app.get(`${config.adminPath}${sub}`, serveDashboard);
    app.get(`${config.adminPath}${sub}/`, serveDashboard);
  }

  if (webDist) {
    for (const file of PUBLIC_FILES) {
      app.get(`/${file}`, async (_request, reply) =>
        reply
          .type('image/svg+xml')
          .header('cache-control', 'public, max-age=86400')
          .sendFile(file, webDist),
      );
    }
  }
}
