import { Type, type Static } from '@sinclair/typebox';

const UUID_PATTERN = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
const Uuid = Type.String({ pattern: UUID_PATTERN });
const NullableString = Type.Union([Type.String(), Type.Null()]);

export const RoleSchema = Type.Union([
  Type.Literal('owner'),
  Type.Literal('admin'),
  Type.Literal('developer'),
  Type.Literal('read_only'),
]);

export const ErrorResponseSchema = Type.Object({
  error: Type.Object({ code: Type.String(), message: Type.String(), requestId: Type.String() }),
});

export const LoginBodySchema = Type.Object(
  {
    username: Type.String({ minLength: 1, maxLength: 64 }),
    password: Type.String({ minLength: 1, maxLength: 256 }),
  },
  { additionalProperties: false },
);

export const UserSchema = Type.Object({ id: Uuid, username: Type.String() });

export const WorkspaceSummarySchema = Type.Object({
  id: Uuid,
  name: Type.String(),
  role: RoleSchema,
});

export const SessionResponseSchema = Type.Object({
  user: UserSchema,
  workspaces: Type.Array(WorkspaceSummarySchema),
  csrfSecret: Type.String(),
  expiresAt: Type.String(),
});

export const WorkspaceParamsSchema = Type.Object({ id: Uuid }, { additionalProperties: false });

export const WorkspaceSchema = Type.Object({
  id: Uuid,
  name: Type.String(),
  role: RoleSchema,
  memberCount: Type.Integer(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const RenameBodySchema = Type.Object(
  { name: Type.String({ minLength: 1, maxLength: 60 }) },
  { additionalProperties: false },
);

export const AuditQuerySchema = Type.Object(
  {
    page: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })),
    pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
  },
  { additionalProperties: false },
);

export const AuditEntrySchema = Type.Object({
  id: Uuid,
  action: Type.String(),
  actor: NullableString,
  targetType: NullableString,
  createdAt: Type.String(),
});

export const AuditPageSchema = Type.Object({
  items: Type.Array(AuditEntrySchema),
  page: Type.Integer(),
  pageSize: Type.Integer(),
  total: Type.Integer(),
});

export const StatusSchema = Type.Object({
  version: Type.String(),
  uptimeSeconds: Type.Integer(),
  database: Type.Object({
    status: Type.Union([Type.Literal('connecting'), Type.Literal('ready'), Type.Literal('error')]),
    lastCheckAt: NullableString,
    reason: NullableString,
  }),
  warnings: Type.Array(Type.String()),
});

export const SessionItemSchema = Type.Object({
  id: Uuid,
  userAgent: NullableString,
  ip: NullableString,
  createdAt: Type.String(),
  lastSeenAt: Type.String(),
  current: Type.Boolean(),
});

export const SessionListSchema = Type.Object({ items: Type.Array(SessionItemSchema) });

export const OkSchema = Type.Object({ ok: Type.Boolean() });
export const CountSchema = Type.Object({ ok: Type.Boolean(), count: Type.Integer() });

export const SessionIdParamsSchema = Type.Object({ id: Uuid }, { additionalProperties: false });

export type SessionResponse = Static<typeof SessionResponseSchema>;
export type WorkspaceSummary = Static<typeof WorkspaceSummarySchema>;
export type WorkspaceDto = Static<typeof WorkspaceSchema>;
export type AuditEntry = Static<typeof AuditEntrySchema>;
export type AuditPage = Static<typeof AuditPageSchema>;
export type StatusDto = Static<typeof StatusSchema>;
export type SessionItem = Static<typeof SessionItemSchema>;
export type SessionList = Static<typeof SessionListSchema>;
