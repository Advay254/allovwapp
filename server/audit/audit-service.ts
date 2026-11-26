import { desc, count, eq, lt } from 'drizzle-orm';
import type { AuditPage } from '@allov/shared';
import type { Executor } from '../db/connection.js';
import { auditLogs } from '../db/schema.js';
import { describeError } from '../lib/log.js';

export interface AuditEntryInput {
  workspaceId: string;
  actorUserId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  requestId?: string;
  ip?: string;
}

interface ErrorLogger {
  error: (obj: unknown, msg?: string) => void;
}

const SECRET_KEY_PATTERN = /pass|secret|token|hash|key|cookie/i;

/** Audit metadata must never hold secrets, so suspicious keys are dropped. */
export function sanitizeMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata ?? {})) {
    if (!SECRET_KEY_PATTERN.test(key)) clean[key] = value;
  }
  return clean;
}

/** Writes one audit entry. A failure is logged and never breaks the action being audited. */
export async function recordAudit(
  db: Executor,
  input: AuditEntryInput,
  log?: ErrorLogger,
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: sanitizeMetadata(input.metadata),
      requestId: input.requestId ?? null,
      ip: input.ip ?? null,
    });
  } catch (err) {
    log?.error({ err: describeError(err), action: input.action }, 'Could not write an audit entry');
  }
}

/** Newest first. The workspace id is part of every query. */
export async function listAudit(
  db: Executor,
  workspaceId: string,
  page: number,
  pageSize: number,
): Promise<AuditPage> {
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      targetType: auditLogs.targetType,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(eq(auditLogs.workspaceId, workspaceId))
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const counted = await db
    .select({ n: count() })
    .from(auditLogs)
    .where(eq(auditLogs.workspaceId, workspaceId));
  return {
    items: rows.map((row) => {
      const actor = row.metadata['actor'];
      return {
        id: row.id,
        action: row.action,
        actor: typeof actor === 'string' ? actor : null,
        targetType: row.targetType,
        createdAt: row.createdAt.toISOString(),
      };
    }),
    page,
    pageSize,
    total: Number(counted[0]?.n ?? 0),
  };
}

/** Deletes entries older than the retention period and returns how many were removed. */
export async function pruneAuditLogs(
  db: Executor,
  retentionDays: number,
  now = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const removed = await db
    .delete(auditLogs)
    .where(lt(auditLogs.createdAt, cutoff))
    .returning({ id: auditLogs.id });
  return removed.length;
}
