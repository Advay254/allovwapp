import { Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { hasSslParams } from '../db/url.js';

export type DatabaseSsl = 'require' | 'verify' | 'off';
export type AllovRole = 'all' | 'api' | 'worker';
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface AppConfig {
  databaseUrl: string;
  databaseSsl: DatabaseSsl;
  databaseCaCert: string | null;
  databasePoolMax: number;
  encryptionKey: string;
  adminUsername: string;
  adminPassword: string;
  adminPath: string;
  baseUrl: string;
  secureCookies: boolean;
  port: number;
  role: AllovRole;
  auditRetentionDays: number;
  logLevel: LogLevel;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

const REQUIRED = ['DATABASE_URL', 'ENCRYPTION_KEY', 'ADMIN_USERNAME', 'ADMIN_PASSWORD', 'BASE_URL'];

const HINTS: Record<string, string> = {
  DATABASE_URL: 'Use a Postgres connection string that starts with postgresql://',
  DATABASE_SSL: 'Use require, verify or off.',
  DATABASE_POOL_MAX: 'Use a whole number from 1 to 50.',
  ENCRYPTION_KEY: 'Use at least 32 characters, for example 64 random hex characters.',
  ADMIN_USERNAME: 'Use 3 to 64 letters, digits, dots, underscores, at signs or hyphens.',
  ADMIN_PASSWORD: 'Use at least 12 characters.',
  BASE_URL: 'Use the public address of the service, for example https://allovwapp.onrender.com',
  PORT: 'Use a whole number from 1 to 65535.',
  ALLOV_ROLE: 'Use all, api or worker.',
  AUDIT_RETENTION_DAYS: 'Use a whole number from 1 to 3650.',
  LOG_LEVEL: 'Use error, warn, info or debug.',
};

const ConfigSchema = Type.Object({
  DATABASE_URL: Type.String({ pattern: '^postgres(ql)?://' }),
  DATABASE_SSL: Type.Union([Type.Literal('require'), Type.Literal('verify'), Type.Literal('off')]),
  DATABASE_POOL_MAX: Type.Integer({ minimum: 1, maximum: 50 }),
  ENCRYPTION_KEY: Type.String({ minLength: 32 }),
  ADMIN_USERNAME: Type.String({ pattern: '^[A-Za-z0-9._@-]{3,64}$' }),
  ADMIN_PASSWORD: Type.String({ minLength: 12, maxLength: 256 }),
  BASE_URL: Type.String({ minLength: 1 }),
  PORT: Type.Integer({ minimum: 1, maximum: 65535 }),
  ALLOV_ROLE: Type.Union([Type.Literal('all'), Type.Literal('api'), Type.Literal('worker')]),
  AUDIT_RETENTION_DAYS: Type.Integer({ minimum: 1, maximum: 3650 }),
  LOG_LEVEL: Type.Union([
    Type.Literal('error'),
    Type.Literal('warn'),
    Type.Literal('info'),
    Type.Literal('debug'),
  ]),
});

const RESERVED_PATH_SEGMENTS = ['api', 'assets', 'health', 'robots.txt', 'sitemap.xml', 'favicon.svg'];

export function normalizeAdminPath(raw: string | undefined): string {
  if (!raw) return '/app';
  let path = raw.trim().toLowerCase();
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/\/+$/, '');
  const shape = /^\/[a-z0-9][a-z0-9_-]{0,62}(\/[a-z0-9][a-z0-9_-]{0,62}){0,2}$/;
  const first = path.split('/')[1] ?? '';
  if (!shape.test(path) || RESERVED_PATH_SEGMENTS.includes(first)) {
    throw new ConfigError(
      'ADMIN_PATH is not valid. Use lowercase letters, digits, hyphens and underscores, for example /app or /console-x7. It cannot start with api, assets or health.',
    );
  }
  return path;
}

export function parseCaCert(raw: string): string {
  const marker = '-----BEGIN CERTIFICATE-----';
  const text = raw.trim();
  const withNewlines = text.replace(/\\n/g, '\n');
  if (withNewlines.includes(marker)) return withNewlines;
  try {
    const decoded = Buffer.from(text, 'base64').toString('utf8').replace(/\\n/g, '\n');
    if (decoded.includes(marker)) return decoded;
  } catch {
    /* fall through to the error below */
  }
  throw new ConfigError(
    'DATABASE_CA_CERT is not a valid certificate. Paste the PEM, the PEM on one line with \\n between lines, or its base64 form.',
  );
}

function isWeakKey(key: string): boolean {
  return key.length < 32 || new Set(key).size < 8;
}

export function loadConfig(env: NodeJS.ProcessEnv): { config: AppConfig; warnings: string[] } {
  const get = (name: string): string | undefined => {
    const value = env[name];
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  };

  for (const name of REQUIRED) {
    if (get(name) === undefined) {
      throw new ConfigError(`${name} is required but is missing or empty. ${HINTS[name] ?? ''}`.trim());
    }
  }

  const candidate = {
    DATABASE_URL: get('DATABASE_URL') as string,
    DATABASE_SSL: get('DATABASE_SSL')?.toLowerCase() ?? 'require',
    DATABASE_POOL_MAX: Number(get('DATABASE_POOL_MAX') ?? 5),
    ENCRYPTION_KEY: get('ENCRYPTION_KEY') as string,
    ADMIN_USERNAME: get('ADMIN_USERNAME') as string,
    ADMIN_PASSWORD: get('ADMIN_PASSWORD') as string,
    BASE_URL: get('BASE_URL') as string,
    PORT: Number(get('PORT') ?? 3000),
    ALLOV_ROLE: get('ALLOV_ROLE')?.toLowerCase() ?? 'all',
    AUDIT_RETENTION_DAYS: Number(get('AUDIT_RETENTION_DAYS') ?? 90),
    LOG_LEVEL: get('LOG_LEVEL')?.toLowerCase() ?? 'warn',
  };

  const firstError = Value.Errors(ConfigSchema, candidate).First();
  if (firstError) {
    const name = firstError.path.replace(/^\//, '');
    throw new ConfigError(`${name} is not valid. ${HINTS[name] ?? ''}`.trim());
  }

  if (isWeakKey(candidate.ENCRYPTION_KEY)) {
    throw new ConfigError(`ENCRYPTION_KEY is too weak. ${HINTS['ENCRYPTION_KEY']}`);
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(candidate.BASE_URL);
  } catch {
    throw new ConfigError(`BASE_URL is not a valid address. ${HINTS['BASE_URL']}`);
  }
  if (baseUrl.protocol !== 'https:' && baseUrl.protocol !== 'http:') {
    throw new ConfigError(`BASE_URL must start with https:// or http://. ${HINTS['BASE_URL']}`);
  }

  const caRaw = get('DATABASE_CA_CERT');
  const config: AppConfig = {
    databaseUrl: candidate.DATABASE_URL,
    databaseSsl: candidate.DATABASE_SSL as DatabaseSsl,
    databaseCaCert: caRaw ? parseCaCert(caRaw) : null,
    databasePoolMax: candidate.DATABASE_POOL_MAX,
    encryptionKey: candidate.ENCRYPTION_KEY,
    adminUsername: candidate.ADMIN_USERNAME.toLowerCase(),
    adminPassword: candidate.ADMIN_PASSWORD,
    adminPath: normalizeAdminPath(get('ADMIN_PATH')),
    baseUrl: baseUrl.origin,
    secureCookies: baseUrl.protocol === 'https:',
    port: candidate.PORT,
    role: candidate.ALLOV_ROLE as AllovRole,
    auditRetentionDays: candidate.AUDIT_RETENTION_DAYS,
    logLevel: candidate.LOG_LEVEL as LogLevel,
  };

  const warnings: string[] = [];
  if (config.adminPassword.length < 16) {
    warnings.push('ADMIN_PASSWORD is shorter than 16 characters. A longer password is safer.');
  }
  if (hasSslParams(config.databaseUrl)) {
    warnings.push(
      'DATABASE_URL contains an ssl or sslmode parameter. It is ignored. Set DATABASE_SSL instead.',
    );
  }
  if (config.databaseSsl === 'off') {
    warnings.push('DATABASE_SSL is off. Database traffic is not encrypted.');
  }
  if (config.databaseSsl === 'verify' && !config.databaseCaCert) {
    warnings.push(
      'DATABASE_SSL is verify without DATABASE_CA_CERT. Only certificates trusted by the system will be accepted.',
    );
  }
  if (!config.secureCookies) {
    warnings.push('BASE_URL does not use https. Session cookies are not marked Secure.');
  }
  return { config, warnings };
}
