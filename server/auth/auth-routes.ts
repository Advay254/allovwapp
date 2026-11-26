import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  CountSchema,
  LoginBodySchema,
  OkSchema,
  SESSION_TTL_SECONDS,
  SessionIdParamsSchema,
  SessionListSchema,
  SessionResponseSchema,
  type SessionResponse,
} from '@allov/shared';
import { recordAudit } from '../audit/audit-service.js';
import { authenticate, requireAuth } from '../http/auth-hook.js';
import { AppError } from '../lib/app-error.js';
import type { AppContext } from '../lib/context.js';
import {
  listWorkspaceIdsForUser,
  listWorkspacesForUser,
} from '../workspaces/workspace-service.js';
import { verifyPassword } from './auth-password.js';
import {
  cookieName,
  createSession,
  listSessions,
  revokeOtherSessions,
  revokeSession,
  type AuthContext,
} from './auth-session.js';
import {
  clearFailures,
  recordFailure,
  secondsBlocked,
  throttleKeys,
} from './auth-throttle.js';
import { findUserByUsername, markLoggedIn } from './auth-users.js';

function tooManyAttempts(seconds: number): AppError {
  return new AppError('too_many_attempts', { headers: { 'Retry-After': String(seconds) } });
}

/** Writes the same audit entry into every workspace the user belongs to. Never throws. */
async function auditForUser(
  ctx: AppContext,
  request: FastifyRequest,
  userId: string,
  action: string,
  username: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const db = ctx.database.db;
    for (const workspaceId of await listWorkspaceIdsForUser(db, userId)) {
      await recordAudit(
        db,
        {
          workspaceId,
          actorUserId: userId,
          action,
          targetType: 'user',
          targetId: userId,
          metadata: { actor: username, ...metadata },
          requestId: request.id,
          ip: request.ip,
        },
        request.log,
      );
    }
  } catch {
    request.log.error({ action }, 'Could not write an audit entry');
  }
}

async function buildSessionResponse(
  ctx: AppContext,
  user: { id: string; username: string },
  csrfSecret: string,
  expiresAt: Date,
): Promise<SessionResponse> {
  return {
    user: { id: user.id, username: user.username },
    workspaces: await listWorkspacesForUser(ctx.database.db, user.id),
    csrfSecret,
    expiresAt: expiresAt.toISOString(),
  };
}

function currentSession(request: FastifyRequest): AuthContext {
  return requireAuth(request);
}

export function registerAuthRoutes(app: FastifyInstance, ctx: AppContext): void {
  const r = app.withTypeProvider<TypeBoxTypeProvider>();
  const guard = authenticate(ctx);
  const cookie = cookieName(ctx.config.secureCookies);

  r.post(
    '/auth/login',
    {
      schema: { body: LoginBodySchema, response: { 200: SessionResponseSchema } },
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const db = ctx.database.db;
      const username = request.body.username.trim().toLowerCase();
      const keys = throttleKeys(ctx.config.encryptionKey, request.ip, username);

      const waiting = await secondsBlocked(db, keys);
      if (waiting > 0) throw tooManyAttempts(waiting);

      const user = await findUserByUsername(db, username);
      const valid = await verifyPassword(user ? user.passwordHash : null, request.body.password);

      if (!user || !valid || user.disabledAt) {
        const wait = await recordFailure(db, keys);
        if (user) void auditForUser(ctx, request, user.id, 'auth.login_failed', user.username);
        if (wait > 0) throw tooManyAttempts(wait);
        throw new AppError('invalid_credentials');
      }

      await clearFailures(db, keys);
      const { token, session } = await createSession(db, {
        userId: user.id,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
      await markLoggedIn(db, user.id);
      reply.setCookie(cookie, token, {
        path: '/',
        httpOnly: true,
        secure: ctx.config.secureCookies,
        sameSite: 'lax',
        maxAge: SESSION_TTL_SECONDS,
      });
      await auditForUser(ctx, request, user.id, 'auth.login', user.username);
      return buildSessionResponse(ctx, user, session.csrfSecret, session.expiresAt);
    },
  );

  r.get(
    '/auth/session',
    { onRequest: guard, schema: { response: { 200: SessionResponseSchema } } },
    async (request) => {
      const auth = currentSession(request);
      return buildSessionResponse(
        ctx,
        { id: auth.userId, username: auth.username },
        auth.csrfSecret,
        auth.expiresAt,
      );
    },
  );

  r.post(
    '/auth/logout',
    { onRequest: guard, schema: { response: { 200: OkSchema } } },
    async (request, reply) => {
      const auth = currentSession(request);
      await revokeSession(ctx.database.db, auth.userId, auth.sessionId);
      reply.clearCookie(cookie, { path: '/' });
      await auditForUser(ctx, request, auth.userId, 'auth.logout', auth.username);
      return { ok: true };
    },
  );

  r.get(
    '/auth/sessions',
    { onRequest: guard, schema: { response: { 200: SessionListSchema } } },
    async (request) => {
      const auth = currentSession(request);
      return { items: await listSessions(ctx.database.db, auth.userId, auth.sessionId) };
    },
  );

  r.delete(
    '/auth/sessions/:id',
    {
      onRequest: guard,
      schema: { params: SessionIdParamsSchema, response: { 200: CountSchema } },
    },
    async (request) => {
      const auth = currentSession(request);
      const removed = await revokeSession(ctx.database.db, auth.userId, request.params.id);
      if (!removed) throw new AppError('not_found');
      await auditForUser(ctx, request, auth.userId, 'auth.session_revoked', auth.username);
      return { ok: true, count: 1 };
    },
  );

  r.delete(
    '/auth/sessions',
    { onRequest: guard, schema: { response: { 200: CountSchema } } },
    async (request) => {
      const auth = currentSession(request);
      const count = await revokeOtherSessions(ctx.database.db, auth.userId, auth.sessionId);
      if (count > 0) {
        await auditForUser(ctx, request, auth.userId, 'auth.sessions_revoked', auth.username, {
          count,
        });
      }
      return { ok: true, count };
    },
  );
}
