import type { FastifyRequest } from 'fastify';
import { CSRF_HEADER } from '@allov/shared';
import { cookieName, validateSession, type AuthContext } from '../auth/auth-session.js';
import { AppError } from '../lib/app-error.js';
import type { AppContext } from '../lib/context.js';
import { safeEqual } from '../lib/crypto.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext | null;
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Route hook that requires a live session. Any request that changes state must also carry
 * the X-Allov-CSRF header that matches the secret stored with the session.
 */
export function authenticate(ctx: AppContext) {
  const name = cookieName(ctx.config.secureCookies);
  const csrfHeader = CSRF_HEADER.toLowerCase();
  return async (request: FastifyRequest): Promise<void> => {
    const token = request.cookies[name];
    if (!token) throw new AppError('unauthenticated');
    const session = await validateSession(ctx.database.db, token);
    if (!session) throw new AppError('unauthenticated');
    if (!SAFE_METHODS.has(request.method)) {
      const header = request.headers[csrfHeader];
      if (typeof header !== 'string' || !safeEqual(header, session.csrfSecret)) {
        throw new AppError('csrf_failed');
      }
    }
    request.auth = session;
  };
}

export function requireAuth(request: FastifyRequest): AuthContext {
  if (!request.auth) throw new AppError('unauthenticated');
  return request.auth;
}
