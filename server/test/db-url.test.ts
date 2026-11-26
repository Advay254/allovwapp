import { describe, expect, it } from 'vitest';
import { buildPoolConfig, shortReason } from '../db/connection.js';
import { hasSslParams, sanitizeConnectionString } from '../db/url.js';

describe('connection string handling', () => {
  it('removes ssl related parameters and keeps the rest', () => {
    expect(sanitizeConnectionString('postgresql://u:p@h:5432/db?sslmode=require&application_name=x')).toBe(
      'postgresql://u:p@h:5432/db?application_name=x',
    );
    expect(sanitizeConnectionString('postgresql://u:p@h:5432/db?ssl=true&sslrootcert=a')).toBe(
      'postgresql://u:p@h:5432/db',
    );
    expect(sanitizeConnectionString('postgresql://u:p@h:5432/db')).toBe('postgresql://u:p@h:5432/db');
    expect(hasSslParams('postgresql://u:p@h/db?sslmode=disable')).toBe(true);
    expect(hasSslParams('postgresql://u:p@h/db')).toBe(false);
  });

  it('builds the pool from DATABASE_SSL and not from the URL', () => {
    const base = { databaseUrl: 'postgresql://u:p@h/db?sslmode=disable', databasePoolMax: 5 };
    const required = buildPoolConfig({ ...base, databaseSsl: 'require', databaseCaCert: null });
    expect(required.ssl).toEqual({ rejectUnauthorized: false });
    expect(required.connectionString).toBe('postgresql://u:p@h/db');
    expect(buildPoolConfig({ ...base, databaseSsl: 'off', databaseCaCert: null }).ssl).toBe(false);
    expect(buildPoolConfig({ ...base, databaseSsl: 'verify', databaseCaCert: 'PEM' }).ssl).toEqual({
      rejectUnauthorized: true,
      ca: 'PEM',
    });
    expect(required.max).toBe(5);
    expect(required.statement_timeout).toBeGreaterThan(0);
  });

  it('gives short, safe reasons', () => {
    expect(shortReason(Object.assign(new Error('x'), { code: 'ECONNREFUSED' }))).toBe('connection refused');
    expect(shortReason(Object.assign(new Error('x'), { code: '28P01' }))).toBe('authentication failed');
    expect(shortReason(new Error('postgresql://user:secret@h/db exploded'))).toBe('connection failed');
  });
});
