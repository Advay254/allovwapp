import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createSession, validateSession } from '../auth/auth-session.js';
import { findUserByUsername } from '../auth/auth-users.js';
import { authSessions, loginAttempts } from '../db/schema.js';
import type { AppContext } from '../lib/context.js';
import { sha256Hex } from '../lib/crypto.js';
import { OWNER, TEST_DB, authed, login, startFresh, stop } from './helpers.js';

const suite = TEST_DB ? describe : describe.skip;

suite('login, sessions and CSRF (real database)', () => {
  let ctx: AppContext;
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ ctx, app } = await startFresh());
  });
  afterAll(async () => {
    await stop(ctx, app);
  });

  it('signs in with the right password and returns the user, workspaces and CSRF secret', async () => {
    const result = await login(app, OWNER.username, OWNER.password, '10.1.0.1');
    expect(result.status).toBe(200);
    expect(result.csrf).toBeTruthy();
    expect(result.cookie).toMatch(/^allov_session=/);
    expect((result.body['workspaces'] as unknown[]).length).toBe(1);
  });

  it('gives identical responses for a wrong password and an unknown user', async () => {
    const wrong = await login(app, OWNER.username, 'wrong-password-1', '10.1.0.2');
    const unknown = await login(app, 'nobody-here', 'wrong-password-1', '10.1.0.3');
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    const a = wrong.body['error'] as Record<string, string>;
    const b = unknown.body['error'] as Record<string, string>;
    expect(a['code']).toBe(b['code']);
    expect(a['message']).toBe(b['message']);
  });

  it('blocks after 5 failures and the wait grows on repeated failures', async () => {
    const ip = '10.2.0.1';
    const name = 'throttle-target';
    const statuses: number[] = [];
    let last = await login(app, name, 'bad-password-xx', ip);
    statuses.push(last.status);
    for (let i = 0; i < 4; i += 1) {
      last = await login(app, name, 'bad-password-xx', ip);
      statuses.push(last.status);
    }
    expect(statuses.slice(0, 4)).toEqual([401, 401, 401, 401]);
    expect(statuses[4]).toBe(429);
    expect(last.headers['retry-after']).toBe('60');

    // Even the right password is refused while blocked.
    const blocked = await login(app, name, 'bad-password-xx', ip);
    expect(blocked.status).toBe(429);

    // Pretend the first wait is over, then fail again: the wait grows to 5 minutes.
    await ctx.database.db.update(loginAttempts).set({ blockedUntil: new Date(Date.now() - 1000) });
    const again = await login(app, name, 'bad-password-xx', ip);
    expect(again.status).toBe(429);
    expect(again.headers['retry-after']).toBe('300');
  });

  it('stores only a hash of the session token and refuses revoked or expired ones', async () => {
    const db = ctx.database.db;
    const owner = await findUserByUsername(db, OWNER.username);
    if (!owner) throw new Error('owner missing');

    const fresh = await createSession(db, { userId: owner.id });
    const rows = await db.select().from(authSessions).where(eq(authSessions.id, fresh.session.id));
    expect(rows[0]?.tokenHash).toBe(sha256Hex(fresh.token));
    expect(rows[0]?.tokenHash).not.toBe(fresh.token);
    expect(await validateSession(db, fresh.token)).not.toBeNull();

    // The 6 hour limit is absolute.
    const sevenHoursAgo = new Date(Date.now() - 7 * 60 * 60 * 1000);
    const old = await createSession(db, { userId: owner.id }, sevenHoursAgo);
    expect(await validateSession(db, old.token)).toBeNull();
    const justInside = await createSession(db, { userId: owner.id }, new Date(Date.now() - 5.9 * 3600 * 1000));
    expect(await validateSession(db, justInside.token)).not.toBeNull();

    // Using a session never extends its expiry.
    const before = (await db.select().from(authSessions).where(eq(authSessions.id, justInside.session.id)))[0];
    await validateSession(db, justInside.token);
    const after = (await db.select().from(authSessions).where(eq(authSessions.id, justInside.session.id)))[0];
    expect(after?.expiresAt.getTime()).toBe(before?.expiresAt.getTime());
  });

  it('revokes the session on logout', async () => {
    const session = await login(app, OWNER.username, OWNER.password, '10.3.0.1');
    const ok = await app.inject({ url: '/api/v1/auth/session', headers: authed(session) });
    expect(ok.statusCode).toBe(200);
    const out = await app.inject({ method: 'POST', url: '/api/v1/auth/logout', payload: {}, headers: authed(session) });
    expect(out.statusCode).toBe(200);
    const after = await app.inject({ url: '/api/v1/auth/session', headers: authed(session) });
    expect(after.statusCode).toBe(401);
  });

  it('rejects state changing requests without the CSRF header', async () => {
    const session = await login(app, OWNER.username, OWNER.password, '10.3.0.2');
    const noHeader = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      payload: {},
      headers: authed(session, false),
    });
    expect(noHeader.statusCode).toBe(403);
    expect(noHeader.json()).toMatchObject({ error: { code: 'csrf_failed' } });
    const wrong = await app.inject({
      method: 'DELETE',
      url: '/api/v1/auth/sessions',
      headers: { ...authed(session, false), 'x-allov-csrf': 'not-the-secret' },
    });
    expect(wrong.statusCode).toBe(403);
    // The session is still alive because nothing was changed.
    const still = await app.inject({ url: '/api/v1/auth/session', headers: authed(session) });
    expect(still.statusCode).toBe(200);
  });

  it('lets a user sign out other sessions but keeps the current one', async () => {
    const one = await login(app, OWNER.username, OWNER.password, '10.3.0.3');
    const two = await login(app, OWNER.username, OWNER.password, '10.3.0.4');
    const removed = await app.inject({ method: 'DELETE', url: '/api/v1/auth/sessions', headers: authed(one) });
    expect(removed.statusCode).toBe(200);
    expect((removed.json() as { count: number }).count).toBeGreaterThanOrEqual(1);
    expect((await app.inject({ url: '/api/v1/auth/session', headers: authed(one) })).statusCode).toBe(200);
    expect((await app.inject({ url: '/api/v1/auth/session', headers: authed(two) })).statusCode).toBe(401);
  });
});
