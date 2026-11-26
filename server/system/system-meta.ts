import { eq, sql } from 'drizzle-orm';
import type { Executor } from '../db/connection.js';
import { systemMeta } from '../db/schema.js';

export async function getMeta(db: Executor, key: string): Promise<string | null> {
  const rows = await db.select({ value: systemMeta.value }).from(systemMeta).where(eq(systemMeta.key, key));
  return rows[0]?.value ?? null;
}

export async function setMeta(db: Executor, key: string, value: string): Promise<void> {
  await db
    .insert(systemMeta)
    .values({ key, value })
    .onConflictDoUpdate({ target: systemMeta.key, set: { value, updatedAt: sql`now()` } });
}
