import { and, count, eq } from 'drizzle-orm';
import type { WorkspaceDto, WorkspaceRole, WorkspaceSummary } from '@allov/shared';
import type { Executor } from '../db/connection.js';
import { workspaceMembers, workspaces } from '../db/schema.js';
import { AppError } from '../lib/app-error.js';

/** Collapses whitespace and rejects empty, long or control character names. */
export function normalizeWorkspaceName(input: string): string {
  const name = input.replace(/\s+/g, ' ').trim();
  if (name.length < 1 || name.length > 60) {
    throw new AppError('validation_failed', {
      message: 'Enter a workspace name from 1 to 60 characters.',
    });
  }
  const hasControl = [...name].some((ch) => {
    const code = ch.charCodeAt(0);
    return code < 32 || code === 127;
  });
  if (hasControl) {
    throw new AppError('validation_failed', {
      message: 'The workspace name contains characters that are not allowed.',
    });
  }
  return name;
}

export async function createWorkspaceWithOwner(
  db: Executor,
  userId: string,
  name: string,
): Promise<string> {
  const created = await db.insert(workspaces).values({ name }).returning({ id: workspaces.id });
  const workspace = created[0];
  if (!workspace) throw new Error('The workspace could not be created.');
  await db.insert(workspaceMembers).values({ workspaceId: workspace.id, userId, role: 'owner' });
  return workspace.id;
}

export async function listWorkspacesForUser(
  db: Executor,
  userId: string,
): Promise<WorkspaceSummary[]> {
  return db
    .select({ id: workspaces.id, name: workspaces.name, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(workspaces.createdAt)
    .limit(50);
}

export async function listWorkspaceIdsForUser(db: Executor, userId: string): Promise<string[]> {
  const rows = await listWorkspacesForUser(db, userId);
  return rows.map((row) => row.id);
}

/** Returns the member's role, or null when the user is not a member of that workspace. */
export async function getMemberRole(
  db: Executor,
  userId: string,
  workspaceId: string,
): Promise<WorkspaceRole | null> {
  const rows = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.workspaceId, workspaceId)))
    .limit(1);
  return rows[0]?.role ?? null;
}

/** A non member gets the same not_found as a missing workspace, so ids cannot be probed. */
export async function getWorkspaceForMember(
  db: Executor,
  userId: string,
  workspaceId: string,
): Promise<WorkspaceDto> {
  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.workspaceId, workspaceId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new AppError('not_found');
  const counted = await db
    .select({ n: count() })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId));
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    memberCount: Number(counted[0]?.n ?? 0),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function renameWorkspace(
  db: Executor,
  userId: string,
  workspaceId: string,
  rawName: string,
): Promise<{ workspace: WorkspaceDto; previousName: string }> {
  const name = normalizeWorkspaceName(rawName);
  const current = await getWorkspaceForMember(db, userId, workspaceId);
  if (current.role !== 'owner' && current.role !== 'admin') throw new AppError('forbidden');
  await db
    .update(workspaces)
    .set({ name, updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId));
  const workspace = await getWorkspaceForMember(db, userId, workspaceId);
  return { workspace, previousName: current.name };
}
