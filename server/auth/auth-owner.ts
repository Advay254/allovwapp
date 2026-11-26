import { sql } from 'drizzle-orm';
import { recordAudit } from '../audit/audit-service.js';
import type { AppContext } from '../lib/context.js';
import {
  createWorkspaceWithOwner,
  listWorkspaceIdsForUser,
} from '../workspaces/workspace-service.js';
import { hashPassword, verifyPassword } from './auth-password.js';
import { revokeAllSessions } from './auth-session.js';
import { countUsers, createUser, findUserByUsername, setPasswordHash } from './auth-users.js';

const OWNER_LOCK_KEY = 7447210003;

/**
 * Runs once the database is ready. Creates the owner, a default workspace and an audit entry
 * when no user exists. When ADMIN_PASSWORD no longer matches, it updates the stored hash and
 * signs the owner out everywhere. This is how access is recovered from a phone.
 */
export async function ensureOwnerAccount(ctx: AppContext): Promise<void> {
  const { config, database, lifecycle, logger } = ctx;
  const db = database.db;
  const existing = await findUserByUsername(db, config.adminUsername);

  if (!existing) {
    if ((await countUsers(db)) > 0) {
      logger.warn('ADMIN_USERNAME does not match an existing account. No account was created or changed.');
      return;
    }
    const passwordHash = await hashPassword(config.adminPassword);
    await db.transaction(async (tx) => {
      // Two instances can start together. The lock makes only one of them create the owner.
      await tx.execute(sql`select pg_advisory_xact_lock(${OWNER_LOCK_KEY})`);
      if ((await countUsers(tx)) > 0) return;
      const userId = await createUser(tx, config.adminUsername, passwordHash);
      const workspaceId = await createWorkspaceWithOwner(tx, userId, 'My workspace');
      const base = { workspaceId, actorUserId: userId, metadata: { actor: config.adminUsername } };
      await recordAudit(tx, {
        ...base,
        action: 'workspace.created',
        targetType: 'workspace',
        targetId: workspaceId,
      });
      await recordAudit(tx, {
        ...base,
        action: 'auth.owner_created',
        targetType: 'user',
        targetId: userId,
      });
    });
  } else if (!(await verifyPassword(existing.passwordHash, config.adminPassword))) {
    await setPasswordHash(db, existing.id, await hashPassword(config.adminPassword));
    const revoked = await revokeAllSessions(db, existing.id);
    for (const workspaceId of await listWorkspaceIdsForUser(db, existing.id)) {
      await recordAudit(db, {
        workspaceId,
        actorUserId: existing.id,
        action: 'auth.password_updated_from_environment',
        targetType: 'user',
        targetId: existing.id,
        metadata: { actor: existing.username, sessionsRevoked: revoked },
      });
    }
    lifecycle.info('Owner password updated from the environment and all sessions were signed out');
  }
  lifecycle.info('Owner account ready');
}
