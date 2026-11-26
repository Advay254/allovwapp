import { and, eq, gte, inArray, lt, or, sql } from 'drizzle-orm';
import { LOGIN_MAX_FAILURES } from '@allov/shared';
import type { Executor } from '../db/connection.js';
import { loginAttempts } from '../db/schema.js';
import { hmacHex } from '../lib/crypto.js';

export const WINDOW_MS = 15 * 60 * 1000;
/** After a block ends, the failure count is forgotten once this much quiet time has passed. */
export const RESET_AFTER_BLOCK_MS = 60 * 60 * 1000;
/** Wait in minutes for the 5th, 6th, 7th and every later failure. */
const WAITS_MINUTES = [1, 5, 15, 60];

export interface AttemptRow {
  failures: number;
  windowStartedAt: Date;
  blockedUntil: Date | null;
}

/** Seconds to wait after a given number of consecutive failures. Zero below the limit. */
export function waitSecondsForFailures(failures: number): number {
  if (failures < LOGIN_MAX_FAILURES) return 0;
  const index = Math.min(failures - LOGIN_MAX_FAILURES, WAITS_MINUTES.length - 1);
  return (WAITS_MINUTES[index] ?? 60) * 60;
}

/** A row is stale when its streak should be forgotten and counting should start again. */
export function isStale(row: AttemptRow, now: Date): boolean {
  if (row.failures < LOGIN_MAX_FAILURES) {
    return now.getTime() - row.windowStartedAt.getTime() > WINDOW_MS;
  }
  const reference = row.blockedUntil ?? row.windowStartedAt;
  return now.getTime() - reference.getTime() > RESET_AFTER_BLOCK_MS;
}

/**
 * Throttle keys are keyed hashes, so the table never stores a raw address or username.
 * One key per client address and one per username.
 */
export function throttleKeys(secret: string, ip: string, username: string): string[] {
  return [hmacHex(secret, `ip:${ip}`), hmacHex(secret, `user:${username.toLowerCase()}`)];
}

/** Seconds that sign in is still blocked for these keys. Zero means not blocked. */
export async function secondsBlocked(
  db: Executor,
  keys: string[],
  now = new Date(),
): Promise<number> {
  const rows = await db.select().from(loginAttempts).where(inArray(loginAttempts.key, keys));
  let longest = 0;
  for (const row of rows) {
    if (!row.blockedUntil || isStale(row, now)) continue;
    const remaining = Math.ceil((row.blockedUntil.getTime() - now.getTime()) / 1000);
    if (remaining > longest) longest = remaining;
  }
  return longest;
}

/**
 * Records one failed attempt for every key. A transaction level advisory lock per key makes
 * the read and write atomic across instances. Returns the longest resulting wait in seconds.
 */
export async function recordFailure(
  db: Executor,
  keys: string[],
  now = new Date(),
): Promise<number> {
  let longest = 0;
  for (const key of keys) {
    const wait = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
      const found = await tx.select().from(loginAttempts).where(eq(loginAttempts.key, key)).limit(1);
      const current = found[0];
      const fresh = !current || isStale(current, now);
      const failures = fresh ? 1 : (current?.failures ?? 0) + 1;
      const windowStartedAt = fresh || !current ? now : current.windowStartedAt;
      const waitSeconds = waitSecondsForFailures(failures);
      const blockedUntil = waitSeconds > 0 ? new Date(now.getTime() + waitSeconds * 1000) : null;
      await tx
        .insert(loginAttempts)
        .values({ key, failures, windowStartedAt, blockedUntil })
        .onConflictDoUpdate({
          target: loginAttempts.key,
          set: { failures, windowStartedAt, blockedUntil },
        });
      return waitSeconds;
    });
    if (wait > longest) longest = wait;
  }
  return longest;
}

export async function clearFailures(db: Executor, keys: string[]): Promise<void> {
  await db.delete(loginAttempts).where(inArray(loginAttempts.key, keys));
}

/** Used by the maintenance sweep. Removes only rows that isStale() would treat as forgotten. */
export async function pruneLoginAttempts(db: Executor, now = new Date()): Promise<number> {
  const windowCutoff = new Date(now.getTime() - WINDOW_MS);
  const blockCutoff = new Date(now.getTime() - RESET_AFTER_BLOCK_MS);
  const removed = await db
    .delete(loginAttempts)
    .where(
      or(
        and(lt(loginAttempts.failures, LOGIN_MAX_FAILURES), lt(loginAttempts.windowStartedAt, windowCutoff)),
        and(
          gte(loginAttempts.failures, LOGIN_MAX_FAILURES),
          lt(sql`coalesce(${loginAttempts.blockedUntil}, ${loginAttempts.windowStartedAt})`, blockCutoff),
        ),
      ),
    )
    .returning({ key: loginAttempts.key });
  return removed.length;
}
