import type { FastifyReply } from 'fastify';
import type { AppConfig } from '../config/index.js';

// No inline scripts and no inline styles. Everything loads from the app's own origin.
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join('; ');

export function isPrivatePath(path: string, adminPath: string): boolean {
  return (
    path.startsWith('/api/') ||
    path === '/health' ||
    path === adminPath ||
    path.startsWith(`${adminPath}/`)
  );
}

export function applySecurityHeaders(reply: FastifyReply, config: AppConfig, url: string): void {
  reply.header('Content-Security-Policy', CSP);
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('Referrer-Policy', 'no-referrer');
  reply.header('Cross-Origin-Opener-Policy', 'same-origin');
  reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  if (config.secureCookies) {
    reply.header('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  const path = url.split('?')[0] ?? '';
  if (isPrivatePath(path, config.adminPath)) {
    reply.header('X-Robots-Tag', 'noindex, nofollow');
    if (!reply.hasHeader('cache-control')) reply.header('Cache-Control', 'no-store');
  }
}
