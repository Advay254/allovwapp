import { drizzle, type NodePgDatabase, type NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { Pool, type PoolConfig } from 'pg';
import type { AppConfig } from '../config/index.js';
import { describeError, type Logger } from '../lib/log.js';
import { MigrationError, runMigrations } from './migrate.js';
import * as schema from './schema.js';
import { sanitizeConnectionString } from './url.js';

export type Db = NodePgDatabase<typeof schema>;
/** Accepts the database or a transaction, so services can join a larger transaction. */
export type Executor = PgDatabase<NodePgQueryResultHKT, typeof schema>;
export type DbStatus = 'connecting' | 'ready' | 'error';

export interface DbState {
  status: DbStatus;
  reason: string | null;
  lastCheckAt: Date | null;
}

type PoolSettings = Pick<
  AppConfig,
  'databaseUrl' | 'databaseSsl' | 'databaseCaCert' | 'databasePoolMax'
>;

export function buildPoolConfig(settings: PoolSettings): PoolConfig {
  let ssl: PoolConfig['ssl'];
  if (settings.databaseSsl === 'off') {
    ssl = false;
  } else if (settings.databaseSsl === 'verify') {
    ssl = {
      rejectUnauthorized: true,
      ...(settings.databaseCaCert ? { ca: settings.databaseCaCert } : {}),
    };
  } else {
    ssl = { rejectUnauthorized: false };
  }
  return {
    connectionString: sanitizeConnectionString(settings.databaseUrl),
    ssl,
    max: settings.databasePoolMax,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 15_000,
    query_timeout: 20_000,
    keepAlive: true,
    application_name: 'allovwapp',
  };
}

/** A short reason that is safe to show on /health and in the dashboard. */
export function shortReason(err: unknown): string {
  const code = describeError(err).code ?? '';
  const message = describeError(err).message.toLowerCase();
  if (code === 'ECONNREFUSED') return 'connection refused';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'database host not found';
  if (code === 'ETIMEDOUT' || message.includes('timeout')) return 'connection timed out';
  if (code === '28P01' || code === '28000') return 'authentication failed';
  if (code === '3D000') return 'database does not exist';
  if (message.includes('ssl') || message.includes('certificate') || message.includes('tls')) {
    return 'secure connection failed';
  }
  return 'connection failed';
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class Database {
  readonly pool: Pool;
  readonly db: Db;
  private status: DbStatus = 'connecting';
  private reason: string | null = null;
  private lastCheckAt: Date | null = null;
  private stopping = false;
  private monitor: NodeJS.Timeout | null = null;
  private readonly readyListeners: Array<() => Promise<void>> = [];

  constructor(
    private readonly config: AppConfig,
    private readonly log: Logger,
    private readonly lifecycle: Logger,
  ) {
    this.pool = new Pool(buildPoolConfig(config));
    this.pool.on('error', (err) => {
      this.log.error({ err: describeError(err) }, 'Idle database connection error');
    });
    this.db = drizzle(this.pool, { schema });
  }

  get state(): DbState {
    return { status: this.status, reason: this.reason, lastCheckAt: this.lastCheckAt };
  }

  isReady(): boolean {
    return this.status === 'ready';
  }

  /** Runs once after the first successful connection and migration. */
  onReady(listener: () => Promise<void>): void {
    this.readyListeners.push(listener);
  }

  /**
   * Connects in the background with growing delays. Connection problems are retried.
   * A failed migration is fatal and rejects, so the caller can stop with a clear message.
   */
  async start(): Promise<void> {
    let delay = 1_500;
    while (!this.stopping) {
      try {
        await this.pool.query('select 1');
        this.lifecycle.info('Database connected');
        const result = await runMigrations(this.pool);
        this.lifecycle.info(
          result.applied > 0
            ? `Migrations applied: ${result.applied}`
            : 'Migrations up to date',
        );
        this.markReady();
        this.startMonitor();
        for (const listener of this.readyListeners) {
          try {
            await listener();
          } catch (err) {
            this.log.error({ err: describeError(err) }, 'A start up task failed');
          }
        }
        return;
      } catch (err) {
        if (err instanceof MigrationError) throw err;
        this.status = 'error';
        this.reason = shortReason(err);
        this.lastCheckAt = new Date();
        this.log.warn(
          { err: describeError(err), retryInMs: delay },
          'Database is not reachable yet, retrying',
        );
        await sleep(delay);
        delay = Math.min(delay * 2, 30_000);
      }
    }
  }

  private markReady(): void {
    this.status = 'ready';
    this.reason = null;
    this.lastCheckAt = new Date();
  }

  private startMonitor(): void {
    this.monitor = setInterval(() => {
      this.pool.query('select 1').then(
        () => this.markReady(),
        (err: unknown) => {
          this.status = 'error';
          this.reason = shortReason(err);
          this.lastCheckAt = new Date();
        },
      );
    }, 15_000);
    this.monitor.unref();
  }

  async close(): Promise<void> {
    this.stopping = true;
    if (this.monitor) clearInterval(this.monitor);
    this.monitor = null;
    await this.pool.end().catch(() => undefined);
  }
}
