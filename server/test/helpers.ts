import type { FastifyInstance } from 'fastify';
import { loadConfig, type AppConfig } from '../config/index.js';
import { ensureOwnerAccount } from '../auth/auth-owner.js';
import { Database } from '../db/connection.js';
import { buildApp } from '../http/app.js';
import type { AppContext } from '../lib/context.js';
import { createLogger } from '../lib/log.js';

export const TEST_DB = process.env['TEST_DATABASE_URL'];

if (!TEST_DB) {
  console.warn(
    'Integration tests are skipped because TEST_DATABASE_URL is not set. Point it at an empty, disposable Postgres database. The tests drop the allov schema.',
  );
}

export const OWNER = { username: 'owner', password: 'owner-password-for-tests' };

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const { config } = loadConfig({
    DATABASE_URL: TEST_DB ?? 'postgresql://user:pass@localhost:5432/test',
    DATABASE_SSL: process.env['TEST_DATABASE_SSL'] ?? 'off',
    ENCRYPTION_KEY: 'test-key-0123456789abcdef0123456789abcdef',
    ADMIN_USERNAME: OWNER.username,
    ADMIN_PASSWORD: OWNER.password,
    BASE_URL: 'http://localhost:3000',
    LOG_LEVEL: 'error',
  });
  return { ...config, ...overrides };
}

export function makeContext(overrides: Partial<AppConfig> = {}): AppContext {
  const config = testConfig(overrides);
  const logger = createLogger('silent');
  const database = new Database(config, logger, logger);
  return { config, configWarnings: [], logger, lifecycle: logger, database };
}

/** Drops the allov schema, connects, migrates and creates the owner. */
export async function startFresh(): Promise<{ ctx: AppContext; app: FastifyInstance }> {
  const ctx = makeContext();
  await ctx.database.pool.query('drop schema if exists allov cascade');
  await ctx.database.start();
  await ensureOwnerAccount(ctx);
  const app = await buildApp(ctx, { webDist: null });
  return { ctx, app };
}

export async function stop(ctx: AppContext, app?: FastifyInstance): Promise<void> {
  if (app) await app.close();
  await ctx.database.close();
}

export interface LoginResult {
  status: number;
  body: Record<string, unknown>;
  headers: Record<string, unknown>;
  cookie: string | null;
  csrf: string | null;
}

export async function login(
  app: FastifyInstance,
  username: string,
  password: string,
  ip = '10.0.0.1',
): Promise<LoginResult> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { username, password },
    remoteAddress: ip,
  });
  const body = res.json() as Record<string, unknown>;
  const cookie = res.cookies[0];
  return {
    status: res.statusCode,
    body,
    headers: res.headers,
    cookie: cookie ? `${cookie.name}=${cookie.value}` : null,
    csrf: typeof body['csrfSecret'] === 'string' ? body['csrfSecret'] : null,
  };
}

export function authed(session: LoginResult, withCsrf = true): Record<string, string> {
  return {
    cookie: session.cookie ?? '',
    ...(withCsrf && session.csrf ? { 'x-allov-csrf': session.csrf } : {}),
  };
}
