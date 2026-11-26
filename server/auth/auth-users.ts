import { count, eq } from 'drizzle-orm';
import type { Executor } from '../db/connection.js';
import { users } from '../db/schema.js';

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  disabledAt: Date | null;
}

export async function findUserByUsername(
  db: Executor,
  username: string,
): Promise<UserRecord | null> {
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      passwordHash: users.passwordHash,
      disabledAt: users.disabledAt,
    })
    .from(users)
    .where(eq(users.username, username.toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
}

export async function createUser(
  db: Executor,
  username: string,
  passwordHash: string,
): Promise<string> {
  const created = await db
    .insert(users)
    .values({ username: username.toLowerCase(), passwordHash })
    .returning({ id: users.id });
  const user = created[0];
  if (!user) throw new Error('The user could not be created.');
  return user.id;
}

export async function setPasswordHash(
  db: Executor,
  userId: string,
  passwordHash: string,
): Promise<void> {
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

export async function markLoggedIn(db: Executor, userId: string): Promise<void> {
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
}

export async function countUsers(db: Executor): Promise<number> {
  const rows = await db.select({ n: count() }).from(users);
  return Number(rows[0]?.n ?? 0);
}
