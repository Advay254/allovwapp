import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Database } from '../db/connection.js';
import { buildApp } from '../http/app.js';
import type { AppContext } from '../lib/context.js';
import { createLogger } from '../lib/log.js';
import { testConfig } from './helpers.js';

// These tests need no database. The database stays in the connecting state.
const LEAK = /node_modules|\/home\/|\bat .+\(.+:\d+:\d+\)|select |insert |ECONN|stack/i;

let app: FastifyInstance;

beforeAll(async () => {
  const dist = mkdtempSync(join(tmpdir(), 'allov-web-'));
  writeFileSync(
    join(dist, 'index.html'),
    '<!doctype html><html><head><!--allov:head--></head><body><div id="root"><!--allov:root--></div></body></html>',
  );
  const config = testConfig({ adminPath: '/console-x7', baseUrl: 'https://allov.example' });
  const logger = createLogger('silent');
  const database = {
    isReady: () => false,
    state: { status: 'connecting', reason: null, lastCheckAt: null },
    db: {},
  } as unknown as Database;
  const ctx: AppContext = { config, configWarnings: [], logger, lifecycle: logger, database };
  app = await buildApp(ctx, { webDist: dist });
});

afterAll(async () => {
  await app.close();
});

describe('public routes', () => {
  it('answers /health with 200 while the database is still connecting', async () => {
    const res = await app.inject({ url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', database: 'connecting' });
    expect(res.headers['x-allov-request-id']).toMatch(/^req_/);
  });

  it('serves the public page with title, description, canonical and Open Graph tags', async () => {
    const res = await app.inject({ url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<title>AllovWapp: One gateway. Every integration.</title>');
    expect(res.body).toContain('rel="canonical" href="https://allov.example/"');
    expect(res.body).toContain('property="og:title"');
    expect(res.body).toContain('name="description"');
    expect(res.body).not.toContain('/console-x7/login');
  });

  it('never lists the dashboard prefix in robots.txt or sitemap.xml', async () => {
    const robots = await app.inject({ url: '/robots.txt' });
    const sitemap = await app.inject({ url: '/sitemap.xml' });
    expect(robots.body).not.toContain('console-x7');
    expect(sitemap.body).not.toContain('console-x7');
    expect(sitemap.body).toContain('<loc>https://allov.example/</loc>');
  });

  it('serves the dashboard page under the private prefix with noindex and no cache', async () => {
    const res = await app.inject({ url: '/console-x7/login' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-robots-tag']).toContain('noindex');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toContain('allov-config');
    expect(res.body).toContain('/console-x7');
  });

  it('returns a designed 404 page with a real 404 status', async () => {
    const res = await app.inject({ url: '/no-such-page' });
    expect(res.statusCode).toBe(404);
    expect(res.body).toContain('Page not found');
    const inside = await app.inject({ url: '/console-x7/unknown' });
    expect(inside.statusCode).toBe(404);
  });

  it('sends strict security headers', async () => {
    const res = await app.inject({ url: '/' });
    const csp = String(res.headers['content-security-policy']);
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain('unsafe-inline');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['strict-transport-security']).toBeDefined();
  });
});

describe('errors', () => {
  it('uses one stable shape and never leaks internals', async () => {
    const urls = ['/api/v1/system/status', '/api/v1/nothing', '/api/v1/workspaces/not-a-uuid'];
    for (const url of urls) {
      const res = await app.inject({ url });
      const body = res.json() as { error: { code: string; message: string; requestId: string } };
      expect(body.error.code).toBeTruthy();
      expect(body.error.message).toBeTruthy();
      expect(body.error.requestId).toMatch(/^req_/);
      expect(res.body).not.toMatch(LEAK);
    }
  });

  it('refuses compressed request bodies and bodies over 1 MB', async () => {
    const compressed = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-encoding': 'gzip', 'content-type': 'application/json' },
      payload: '{}',
    });
    expect(compressed.statusCode).toBe(415);
    const big = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ username: 'a', password: 'x'.repeat(1_100_000) }),
    });
    expect(big.statusCode).toBe(413);
    expect(big.json()).toMatchObject({ error: { code: 'payload_too_large' } });
  });
});
