import { pino, type Logger } from 'pino';

export type { Logger };

const REDACT_PATHS = [
  'password',
  '*.password',
  'passwordHash',
  '*.passwordHash',
  'password_hash',
  '*.password_hash',
  'token',
  '*.token',
  'csrfSecret',
  '*.csrfSecret',
  'csrf_secret',
  '*.csrf_secret',
  'databaseUrl',
  '*.databaseUrl',
  'encryptionKey',
  '*.encryptionKey',
  'adminPassword',
  '*.adminPassword',
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.authorization',
  'headers.cookie',
  'res.headers["set-cookie"]',
];

export function createLogger(level: string): Logger {
  return pino({
    level,
    base: { service: 'allovwapp' },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
  });
}

/** Removes credentials from anything that looks like scheme://user:password@host. */
export function scrubSecrets(text: string): string {
  return text.replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi, '$1[redacted]@');
}

export function describeError(err: unknown): { code: string | null; message: string } {
  if (err instanceof Error) {
    const code = (err as Error & { code?: unknown }).code;
    return { code: typeof code === 'string' ? code : null, message: scrubSecrets(err.message) };
  }
  return { code: null, message: scrubSecrets(String(err)) };
}
