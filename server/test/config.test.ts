import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig, normalizeAdminPath, parseCaCert } from '../config/index.js';

const VALID = {
  DATABASE_URL: 'postgresql://user:pass@host:5432/db',
  ENCRYPTION_KEY: 'abcdef0123456789abcdef0123456789abcdef01',
  ADMIN_USERNAME: 'Owner',
  ADMIN_PASSWORD: 'a-long-enough-password',
  BASE_URL: 'https://example.onrender.com/',
};

describe('configuration', () => {
  it('loads a valid environment with safe defaults', () => {
    const { config, warnings } = loadConfig(VALID);
    expect(config.port).toBe(3000);
    expect(config.databaseSsl).toBe('require');
    expect(config.databasePoolMax).toBe(5);
    expect(config.adminPath).toBe('/app');
    expect(config.adminUsername).toBe('owner');
    expect(config.baseUrl).toBe('https://example.onrender.com');
    expect(config.secureCookies).toBe(true);
    expect(config.logLevel).toBe('warn');
    expect(warnings).toHaveLength(0);
  });

  for (const name of Object.keys(VALID)) {
    it(`names ${name} when it is missing`, () => {
      const env: Record<string, string | undefined> = { ...VALID, [name]: undefined };
      expect(() => loadConfig(env)).toThrowError(new RegExp(name));
    });
  }

  it('refuses a weak ENCRYPTION_KEY', () => {
    expect(() => loadConfig({ ...VALID, ENCRYPTION_KEY: 'short' })).toThrowError(/ENCRYPTION_KEY/);
    expect(() => loadConfig({ ...VALID, ENCRYPTION_KEY: 'a'.repeat(40) })).toThrowError(
      /ENCRYPTION_KEY is too weak/,
    );
  });

  it('refuses a short ADMIN_PASSWORD and warns below 16 characters', () => {
    expect(() => loadConfig({ ...VALID, ADMIN_PASSWORD: 'short' })).toThrowError(/ADMIN_PASSWORD/);
    const { warnings } = loadConfig({ ...VALID, ADMIN_PASSWORD: 'twelve-chars' });
    expect(warnings.join(' ')).toMatch(/ADMIN_PASSWORD/);
  });

  it('ignores an sslmode parameter in DATABASE_URL and says so', () => {
    const { config, warnings } = loadConfig({
      ...VALID,
      DATABASE_URL: 'postgresql://u:p@h:5432/db?sslmode=disable',
    });
    expect(config.databaseSsl).toBe('require');
    expect(warnings.join(' ')).toMatch(/sslmode|ssl/i);
  });

  it('rejects invalid optional values by name', () => {
    expect(() => loadConfig({ ...VALID, PORT: 'abc' })).toThrowError(/PORT/);
    expect(() => loadConfig({ ...VALID, DATABASE_SSL: 'maybe' })).toThrowError(/DATABASE_SSL/);
    expect(() => loadConfig({ ...VALID, ALLOV_ROLE: 'boss' })).toThrowError(/ALLOV_ROLE/);
  });

  it('validates ADMIN_PATH', () => {
    expect(normalizeAdminPath(undefined)).toBe('/app');
    expect(normalizeAdminPath('Console-X7/')).toBe('/console-x7');
    expect(() => normalizeAdminPath('/api')).toThrowError(ConfigError);
    expect(() => normalizeAdminPath('/a b')).toThrowError(ConfigError);
  });

  it('accepts a CA certificate as PEM, one line PEM or base64', () => {
    const pem = '-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----';
    expect(parseCaCert(pem)).toBe(pem);
    expect(parseCaCert(pem.replace(/\n/g, '\\n'))).toBe(pem);
    expect(parseCaCert(Buffer.from(pem).toString('base64'))).toBe(pem);
    expect(() => parseCaCert('not a certificate')).toThrowError(ConfigError);
  });
});
