import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Pool, PoolClient } from 'pg';

/** Advisory lock key that serialises migrations across instances. */
export const MIGRATION_LOCK_KEY = 7447210001;

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

export function resolveMigrationsDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(process.cwd(), 'migrations'),
    resolve(here, '../../migrations'),
    resolve(here, '../../../migrations'),
  ];
  const found = candidates.find((dir) => existsSync(resolve(dir, 'meta', '_journal.json')));
  if (!found) {
    throw new MigrationError(
      'The migrations folder was not found. It must sit at the repository root next to package.json.',
    );
  }
  return found;
}

async function countApplied(client: PoolClient): Promise<number> {
  const exists = await client.query<{ t: string | null }>(
    `select to_regclass('allov.__drizzle_migrations') as t`,
  );
  if (!exists.rows[0]?.t) return 0;
  const result = await client.query<{ n: number }>(
    'select count(*)::int as n from "allov"."__drizzle_migrations"',
  );
  return result.rows[0]?.n ?? 0;
}

/** SQLSTATE classes that mean the connection broke, which the caller retries. */
function isConnectionProblem(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  if (typeof code !== 'string') return true;
  if (!/^[0-9A-Z]{5}$/.test(code)) return true;
  return code.startsWith('08') || code.startsWith('57P') || code.startsWith('53');
}

/**
 * Applies pending migrations while holding a Postgres advisory lock on one dedicated
 * connection, so two instances starting together cannot collide. All pending
 * migrations run in a single transaction, so a failure leaves nothing half applied.
 */
export async function runMigrations(
  pool: Pool,
  folder: string = resolveMigrationsDir(),
): Promise<{ applied: number; total: number }> {
  const client = await pool.connect();
  try {
    await client.query('select pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    try {
      const before = await countApplied(client);
      await migrate(drizzle(client), { migrationsFolder: folder, migrationsSchema: 'allov' });
      const after = await countApplied(client);
      return { applied: after - before, total: after };
    } finally {
      await client.query('select pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]).catch(() => undefined);
    }
  } catch (err) {
    if (isConnectionProblem(err)) throw err;
    const detail = err instanceof Error ? err.message : String(err);
    throw new MigrationError(`A database migration failed and was rolled back: ${detail}`);
  } finally {
    client.release();
  }
}
