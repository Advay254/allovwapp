import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { hashPassword } from '../auth/auth-password.js';
import { createUser, findUserByUsername } from '../auth/auth-users.js';
import { workspaceMembers } from '../db/schema.js';
import type { AppContext } from '../lib/context.js';
import { AppError } from '../lib/app-error.js';
import {
  createWorkspaceWithOwner,
  getWorkspaceForMember,
  listWorkspacesForUser,
  renameWorkspace,
} from '../workspaces/workspace-service.js';
import { listAudit } from '../audit/audit-service.js';
import { OWNER, TEST_DB, authed, login, startFresh, stop } from './helpers.js';

const suite = TEST_DB ? describe : describe.skip;

suite('workspace isolation and roles (real database)', () => {
  let ctx: AppContext;
  let app: FastifyInstance;
  let aliceId = '';
  let bobId = '';
  let carolId = '';
  let wsA = '';
  let wsB = '';

  beforeAll(async () => {
    ({ ctx, app } = await startFresh());
    const db = ctx.database.db;
    const owner = await findUserByUsername(db, OWNER.username);
    if (!owner) throw new Error('owner missing');
    aliceId = owner.id;
    wsA = (await listWorkspacesForUser(db, aliceId))[0]?.id ?? '';
    const hash = await hashPassword('another-long-password-1');
    bobId = await createUser(db, 'bob', hash);
    wsB = await createWorkspaceWithOwner(db, bobId, 'Bob workspace');
    carolId = await createUser(db, 'carol', hash);
    await db.insert(workspaceMembers).values({ workspaceId: wsA, userId: carolId, role: 'read_only' });
  });
  afterAll(async () => {
    await stop(ctx, app);
  });

  it('service layer: a member of A cannot read, rename or audit B', async () => {
    const db = ctx.database.db;
    await expect(getWorkspaceForMember(db, aliceId, wsB)).rejects.toMatchObject({ code: 'not_found' });
    await expect(renameWorkspace(db, aliceId, wsB, 'Taken over')).rejects.toBeInstanceOf(AppError);
    expect(await getWorkspaceForMember(db, bobId, wsB)).toMatchObject({ name: 'Bob workspace' });
    // The audit query itself is scoped by workspace id.
    const auditA = await listAudit(db, wsA, 1, 50);
    const auditB = await listAudit(db, wsB, 1, 50);
    expect(auditA.items.length).toBeGreaterThan(0);
    expect(auditB.items).toHaveLength(0);
  });

  it('HTTP layer: guessing the id of workspace B returns not_found for A', async () => {
    const alice = await login(app, OWNER.username, OWNER.password, '10.4.0.1');
    const get = await app.inject({ url: `/api/v1/workspaces/${wsB}`, headers: authed(alice) });
    expect(get.statusCode).toBe(404);
    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/workspaces/${wsB}`,
      payload: { name: 'Hijacked' },
      headers: authed(alice),
    });
    expect(patch.statusCode).toBe(404);
    const audit = await app.inject({ url: `/api/v1/workspaces/${wsB}/audit`, headers: authed(alice) });
    expect(audit.statusCode).toBe(404);
    // B's name is unchanged.
    expect((await getWorkspaceForMember(ctx.database.db, bobId, wsB)).name).toBe('Bob workspace');
  });

  it('HTTP layer: a member reads and renames their own workspace, and it is audited', async () => {
    const alice = await login(app, OWNER.username, OWNER.password, '10.4.0.2');
    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/workspaces/${wsA}`,
      payload: { name: '  Studio   One  ' },
      headers: authed(alice),
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json()).toMatchObject({ name: 'Studio One', role: 'owner' });
    const audit = await app.inject({ url: `/api/v1/workspaces/${wsA}/audit?pageSize=5`, headers: authed(alice) });
    const actions = (audit.json() as { items: Array<{ action: string }> }).items.map((i) => i.action);
    expect(actions).toContain('workspace.renamed');
    expect(actions).toContain('auth.login');
  });

  it('a read_only member cannot rename the workspace', async () => {
    const carol = await login(app, 'carol', 'another-long-password-1', '10.4.0.3');
    expect(carol.status).toBe(200);
    const read = await app.inject({ url: `/api/v1/workspaces/${wsA}`, headers: authed(carol) });
    expect(read.statusCode).toBe(200);
    expect(read.json()).toMatchObject({ role: 'read_only' });
    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/workspaces/${wsA}`,
      payload: { name: 'Nope' },
      headers: authed(carol),
    });
    expect(patch.statusCode).toBe(403);
    expect(patch.json()).toMatchObject({ error: { code: 'forbidden' } });
  });

  it('bounds the audit page size and rejects bad parameters', async () => {
    const alice = await login(app, OWNER.username, OWNER.password, '10.4.0.4');
    const tooBig = await app.inject({ url: `/api/v1/workspaces/${wsA}/audit?pageSize=500`, headers: authed(alice) });
    expect(tooBig.statusCode).toBe(400);
    const badId = await app.inject({ url: '/api/v1/workspaces/not-a-uuid', headers: authed(alice) });
    expect(badId.statusCode).toBe(400);
    expect(badId.body).not.toMatch(/select |node_modules|\bat .+\(/i);
  });
});
