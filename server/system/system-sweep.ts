import { sql } from 'drizzle-orm';
import { pruneAuditLogs } from '../audit/audit-service.js';
import { pruneExpiredSessions } from '../auth/auth-session.js';
import { pruneLoginAttempts } from '../auth/auth-throttle.js';
import type { Db } from '../db/connection.js';
import type { Job } from '../lib/job-runner.js';
import type { AppContext } from '../lib/context.js';
import { setMeta } from './system-meta.js';

const SWEEP_LOCK_KEY = 7447210002;

export interface SweepResult {
  sessions: number;
  loginAttempts: number;
  auditLogs: number;
}

/**
 * Deletes expired sessions, forgotten login attempts and audit entries past the retention
 * period. A transaction level advisory lock lets only one instance sweep at a time. Returns
 * null when another instance holds the lock.
 */
export async function runMaintenanceSweep(
  db: Db,
  retentionDays: number,
  now = new Date(),
): Promise<SweepResult | null> {
  return db.transaction(async (tx) => {
    const lock = await tx.execute(sql`select pg_try_advisory_xact_lock(${SWEEP_LOCK_KEY}) as locked`);
    const first = lock.rows[0] as { locked?: boolean } | undefined;
    if (first?.locked !== true) return null;
    const result: SweepResult = {
      sessions: await pruneExpiredSessions(tx, now),
      loginAttempts: await pruneLoginAttempts(tx, now),
      auditLogs: await pruneAuditLogs(tx, retentionDays, now),
    };
    await setMeta(tx, 'last_sweep', JSON.stringify({ at: now.toISOString(), ...result }));
    return result;
  });
}

export function createSweepJob(ctx: AppContext): Job {
  return {
    name: 'maintenance-sweep',
    everyMs: 60 * 60 * 1000,
    initialDelayMs: 60 * 1000,
    run: async () => {
      if (!ctx.database.isReady()) return;
      const result = await runMaintenanceSweep(ctx.database.db, ctx.config.auditRetentionDays);
      if (result) {
        ctx.lifecycle.info(
          {
            sessionsRemoved: result.sessions,
            loginAttemptsRemoved: result.loginAttempts,
            auditEntriesRemoved: result.auditLogs,
          },
          'Maintenance sweep finished',
        );
      }
    },
  };
}
