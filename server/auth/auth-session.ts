import { and, desc, eq, gt, isNull, lt, ne } from 'drizzle-orm';
import {
  SESSION_COOKIE_PLAIN,
  SESSION_COOKIE_SECURE,
  SESSION_TTL_SECONDS,
  type SessionItem,
} from '@allov/shared';
import type { Executor } from '../db/connection.js';
import { authSessions, users } from '../db/schema.js';
import { randomToken, sha256Hex } from '../lib/crypto.js';

export interface AuthContext {
  sessionId: string;
  userId: string;
  username: string;
  csrfSecret: string;
  expiresAt: Date;
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,100}$/;
const TOUCH_AFTER_MS = 60_000;

export function cookieName(secure: boolean): string {
  return secure ? SESSION_COOKIE_SECURE : SESSION_COOKIE_PLAIN;
}

function clip(value: string | undefined, max: number): string | null {
  if (!value) return null;
  return value.length > max ? value.slice(0, max) : value;
}

/** The browser keeps the random token. The database keeps only its SHA-256 hash. */
export async function createSession(
  db: Executor,
  input: { userId: string; ip?: string; userAgent?: string },
  now = new Date(),
): Promise<{ token: string; session: { id: string; csrfSecret: string; expiresAt: Date } }> {
  const token = randomToken(32);
  const csrfSecret = randomToken(24);
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
  const created = await db
    .insert(authSessions)
    .values({
      userId: input.userId,
      tokenHash: sha256Hex(token),
      csrfSecret,
      createdAt: now,
      expiresAt,
      lastSeenAt: now,
      ip: clip(input.ip, 64),
      userAgent: clip(input.userAgent, 300),
    })
    .returning({ id: authSessions.id });
  const row = created[0];
  if (!row) throw new Error('The session could not be created.');
  return { token, session: { id: row.id, csrfSecret, expiresAt } };
}

/**
 * Finds a live session for a token. The 6 hour limit is absolute: last_seen_at is updated
 * for display only and never extends expires_at. A revoked session is a deleted row.
 */
export async function validateSession(
  db: Executor,
  token: string,
  now = new Date(),
): Promise<AuthContext | null> {
  if (!TOKEN_PATTERN.test(token)) return null;
  const rows = await db
    .select({
      sessionId: authSessions.id,
      userId: authSessions.userId,
      csrfSecret: authSessions.csrfSecret,
      expiresAt: authSessions.expiresAt,
      lastSeenAt: authSessions.lastSeenAt,
      username: users.username,
    })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .where(
      and(
        eq(authSessions.tokenHash, sha256Hex(token)),
        gt(authSessions.expiresAt, now),
        isNull(users.disabledAt),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (now.getTime() - row.lastSeenAt.getTime() > TOUCH_AFTER_MS) {
    await db
      .update(authSessions)
      .set({ lastSeenAt: now })
      .where(eq(authSessions.id, row.sessionId));
  }
  return {
    sessionId: row.sessionId,
    userId: row.userId,
    username: row.username,
    csrfSecret: row.csrfSecret,
    expiresAt: row.expiresAt,
  };
}

/** Revokes one session, but only if it belongs to the given user. */
export async function revokeSession(
  db: Executor,
  userId: string,
  sessionId: string,
): Promise<boolean> {
  const removed = await db
    .delete(authSessions)
    .where(and(eq(authSessions.id, sessionId), eq(authSessions.userId, userId)))
    .returning({ id: authSessions.id });
  return removed.length > 0;
}

export async function revokeOtherSessions(
  db: Executor,
  userId: string,
  keepSessionId: string,
): Promise<number> {
  const removed = await db
    .delete(authSessions)
    .where(and(eq(authSessions.userId, userId), ne(authSessions.id, keepSessionId)))
    .returning({ id: authSessions.id });
  return removed.length;
}

export async function revokeAllSessions(db: Executor, userId: string): Promise<number> {
  const removed = await db
    .delete(authSessions)
    .where(eq(authSessions.userId, userId))
    .returning({ id: authSessions.id });
  return removed.length;
}

export async function listSessions(
  db: Executor,
  userId: string,
  currentSessionId: string,
  now = new Date(),
): Promise<SessionItem[]> {
  const rows = await db
    .select({
      id: authSessions.id,
      userAgent: authSessions.userAgent,
      ip: authSessions.ip,
      createdAt: authSessions.createdAt,
      lastSeenAt: authSessions.lastSeenAt,
    })
    .from(authSessions)
    .where(and(eq(authSessions.userId, userId), gt(authSessions.expiresAt, now)))
    .orderBy(desc(authSessions.lastSeenAt))
    .limit(50);
  return rows.map((row) => ({
    id: row.id,
    userAgent: row.userAgent,
    ip: row.ip,
    createdAt: row.createdAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    current: row.id === currentSessionId,
  }));
}

/** Used by the maintenance sweep. Removes only sessions that have already expired. */
export async function pruneExpiredSessions(db: Executor, now = new Date()): Promise<number> {
  const removed = await db
    .delete(authSessions)
    .where(lt(authSessions.expiresAt, now))
    .returning({ id: authSessions.id });
  return removed.length;
}
