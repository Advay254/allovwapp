import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/** Every table lives in the allov schema so it never collides with another application. */
export const allov = pgSchema('allov');

export const workspaceRole = allov.enum('workspace_role', [
  'owner',
  'admin',
  'developer',
  'read_only',
]);

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const users = allov.table(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    username: text('username').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    lastLoginAt: timestamptz('last_login_at'),
    disabledAt: timestamptz('disabled_at'),
  },
  (t) => [check('users_username_lowercase', sql`${t.username} = lower(${t.username})`)],
);

export const workspaces = allov.table('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

export const workspaceMembers = allov.table(
  'workspace_members',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: workspaceRole('role').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.userId] }),
    index('workspace_members_user_idx').on(t.userId),
  ],
);

export const authSessions = allov.table(
  'auth_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    csrfSecret: text('csrf_secret').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    expiresAt: timestamptz('expires_at').notNull(),
    lastSeenAt: timestamptz('last_seen_at').notNull().defaultNow(),
    ip: text('ip'),
    userAgent: text('user_agent'),
  },
  (t) => [
    uniqueIndex('auth_sessions_token_hash_idx').on(t.tokenHash),
    index('auth_sessions_expires_at_idx').on(t.expiresAt),
    index('auth_sessions_user_idx').on(t.userId),
  ],
);

export const loginAttempts = allov.table('login_attempts', {
  key: text('key').primaryKey(),
  failures: integer('failures').notNull().default(0),
  windowStartedAt: timestamptz('window_started_at').notNull().defaultNow(),
  blockedUntil: timestamptz('blocked_until'),
});

export const auditLogs = allov.table(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    requestId: text('request_id'),
    ip: text('ip'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('audit_logs_workspace_created_idx').on(t.workspaceId, t.createdAt.desc()),
    index('audit_logs_created_idx').on(t.createdAt),
  ],
);

export const systemMeta = allov.table('system_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});
