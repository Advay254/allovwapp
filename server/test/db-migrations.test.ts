import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { runMigrations } from '../db/migrate.js';
import { Database } from '../db/connection.js';
import type { AppContext } from '../lib/context.js';
import { TEST_DB, makeContext, stop } from './helpers.js';

const suite = TEST_DB ? describe : describe.skip;

suite('migrations (real database)', () => {
  let ctx: AppContext;
  let second: Database;
  const app: FastifyInstance | undefined = undefined;

  beforeAll(async () => {
    ctx = makeContext();
    second = new Database(ctx.config, ctx.logger, ctx.logger);
    await ctx.database.pool.query('drop schema if exists allov cascade');
  });
  afterAll(async () => {
    await second.close();
    await stop(ctx, app);
  });

  it('applies everything to a clean database, even when two starts collide', async () => {
    const [a, b] = await Promise.all([
      runMigrations(ctx.database.pool),
      runMigrations(second.pool),
    ]);
    expect(a.applied + b.applied).toBe(1);
    expect(a.total).toBe(1);
    const tables = await ctx.database.pool.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'allov' order by 1`,
    );
    const names = tables.rows.map((row) => row.table_name);
    for (const table of [
      'users',
      'workspaces',
      'workspace_members',
      'auth_sessions',
      'login_attempts',
      'audit_logs',
      'system_meta',
    ]) {
      expect(names).toContain(table);
    }
  });

  it('changes nothing when run again', async () => {
    const again = await runMigrations(ctx.database.pool);
    expect(again.applied).toBe(0);
    expect(again.total).toBe(1);
  });

  it('keeps every table inside the allov schema', async () => {
    const stray = await ctx.database.pool.query(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_name in ('users','workspaces','auth_sessions','audit_logs')`,
    );
    expect(stray.rowCount).toBe(0);
  });
});
