import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createSession } from '../auth/auth-session.js';
import { findUserByUsername } from '../auth/auth-users.js';
import { listWorkspacesForUser } from '../workspaces/workspace-service.js';
import { auditLogs, authSessions, loginAttempts } from '../db/schema.js';
import type { AppContext } from '../lib/context.js';
import { runMaintenanceSweep } from '../system/system-sweep.js';
import { OWNER, TEST_DB, startFresh, stop } from './helpers.js';

const suite = TEST_DB ? describe : describe.skip;

suite('maintenance sweep (real database)', () => {
  let ctx: AppContext;
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ ctx, app } = await startFresh());
  });
  afterAll(async () => {
    await stop(ctx, app);
  });

  it('removes only expired sessions, forgotten attempts and audit entries past retention', async () => {
    const db = ctx.database.db;
    const owner = await findUserByUsername(db, OWNER.username);
    if (!owner) throw new Error('owner missing');
    const workspaceId = (await listWorkspacesForUser(db, owner.id))[0]?.id ?? '';
    const now = new Date();

    const live = await createSession(db, { userId: owner.id }, now);
    await createSession(db, { userId: owner.id }, new Date(now.getTime() - 8 * 3600 * 1000));

    await db.insert(loginAttempts).values([
      { key: 'stale', failures: 2, windowStartedAt: new Date(now.getTime() - 2 * 3600 * 1000) },
      { key: 'recent', failures: 2, windowStartedAt: now },
      {
        key: 'blocked-now',
        failures: 6,
        windowStartedAt: now,
        blockedUntil: new Date(now.getTime() + 300_000),
      },
    ]);

    await db.insert(auditLogs).values([
      { workspaceId, action: 'test.old', createdAt: new Date(now.getTime() - 200 * 86400 * 1000) },
      { workspaceId, action: 'test.recent', createdAt: now },
    ]);

    const result = await runMaintenanceSweep(db, 90, now);
    expect(result).toEqual({ sessions: 1, loginAttempts: 1, auditLogs: 1 });

    const sessions = await db.select().from(authSessions);
    expect(sessions.map((row) => row.id)).toContain(live.session.id);
    expect(sessions).toHaveLength(1);
    const attempts = (await db.select().from(loginAttempts)).map((row) => row.key).sort();
    expect(attempts).toEqual(['blocked-now', 'recent']);
    const actions = (await db.select().from(auditLogs)).map((row) => row.action);
    expect(actions).toContain('test.recent');
    expect(actions).not.toContain('test.old');
  });
});
