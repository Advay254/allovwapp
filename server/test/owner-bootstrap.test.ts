import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { ensureOwnerAccount } from '../auth/auth-owner.js';
import { verifyPassword } from '../auth/auth-password.js';
import { createSession } from '../auth/auth-session.js';
import { findUserByUsername } from '../auth/auth-users.js';
import { authSessions, users, workspaceMembers, workspaces } from '../db/schema.js';
import type { AppContext } from '../lib/context.js';
import { OWNER, TEST_DB, makeContext, startFresh, stop } from './helpers.js';

const suite = TEST_DB ? describe : describe.skip;

suite('owner bootstrap (real database)', () => {
  let ctx: AppContext;
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ ctx, app } = await startFresh());
  });
  afterAll(async () => {
    await stop(ctx, app);
  });

  it('creates the owner, a default workspace and an owner membership', async () => {
    const db = ctx.database.db;
    const owner = await findUserByUsername(db, OWNER.username);
    expect(owner).not.toBeNull();
    expect(owner?.passwordHash.startsWith('$argon2id$')).toBe(true);
    const spaces = await db.select().from(workspaces);
    expect(spaces.map((row) => row.name)).toEqual(['My workspace']);
    const members = await db.select().from(workspaceMembers);
    expect(members).toHaveLength(1);
    expect(members[0]?.role).toBe('owner');
  });

  it('does nothing new when started again', async () => {
    await ensureOwnerAccount(ctx);
    expect(await ctx.database.db.select().from(users)).toHaveLength(1);
    expect(await ctx.database.db.select().from(workspaces)).toHaveLength(1);
  });

  it('updates the hash and revokes sessions when ADMIN_PASSWORD changes', async () => {
    const db = ctx.database.db;
    const owner = await findUserByUsername(db, OWNER.username);
    if (!owner) throw new Error('owner missing');
    await createSession(db, { userId: owner.id });
    expect(await db.select().from(authSessions).where(eq(authSessions.userId, owner.id))).toHaveLength(1);

    const changed: AppContext = {
      ...makeContext({ adminPassword: 'a-brand-new-owner-password' }),
      database: ctx.database,
    };
    await ensureOwnerAccount(changed);

    const after = await findUserByUsername(db, OWNER.username);
    expect(await verifyPassword(after?.passwordHash ?? null, 'a-brand-new-owner-password')).toBe(true);
    expect(await verifyPassword(after?.passwordHash ?? null, OWNER.password)).toBe(false);
    expect(await db.select().from(authSessions).where(eq(authSessions.userId, owner.id))).toHaveLength(0);
  });
});
