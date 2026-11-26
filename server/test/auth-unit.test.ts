import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../auth/auth-password.js';
import {
  isStale,
  throttleKeys,
  waitSecondsForFailures,
  RESET_AFTER_BLOCK_MS,
  WINDOW_MS,
} from '../auth/auth-throttle.js';
import { randomToken, safeEqual, sha256Hex } from '../lib/crypto.js';

describe('password hashing', () => {
  it('uses Argon2id and verifies correctly', async () => {
    const stored = await hashPassword('correct horse battery');
    expect(stored.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(stored, 'correct horse battery')).toBe(true);
    expect(await verifyPassword(stored, 'wrong')).toBe(false);
    expect(await verifyPassword('not-a-hash', 'x')).toBe(false);
  });

  it('still does the work for an unknown user and returns false', async () => {
    expect(await verifyPassword(null, 'anything')).toBe(false);
  });
});

describe('throttle rules', () => {
  it('waits 1, 5, 15 then 60 minutes from the fifth failure', () => {
    expect(waitSecondsForFailures(4)).toBe(0);
    expect(waitSecondsForFailures(5)).toBe(60);
    expect(waitSecondsForFailures(6)).toBe(300);
    expect(waitSecondsForFailures(7)).toBe(900);
    expect(waitSecondsForFailures(8)).toBe(3600);
    expect(waitSecondsForFailures(30)).toBe(3600);
  });

  it('forgets quiet streaks', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    const old = new Date(now.getTime() - WINDOW_MS - 1000);
    expect(isStale({ failures: 3, windowStartedAt: old, blockedUntil: null }, now)).toBe(true);
    expect(isStale({ failures: 3, windowStartedAt: now, blockedUntil: null }, now)).toBe(false);
    const blockEnded = new Date(now.getTime() - RESET_AFTER_BLOCK_MS - 1000);
    expect(isStale({ failures: 6, windowStartedAt: old, blockedUntil: blockEnded }, now)).toBe(true);
    expect(isStale({ failures: 6, windowStartedAt: old, blockedUntil: now }, now)).toBe(false);
  });

  it('never stores a raw address or username in the keys', () => {
    const keys = throttleKeys('secret-secret-secret-secret-secret-1', '203.0.113.9', 'Owner');
    expect(keys).toHaveLength(2);
    for (const key of keys) {
      expect(key).toMatch(/^[0-9a-f]{64}$/);
      expect(key).not.toContain('203');
    }
    expect(throttleKeys('secret-secret-secret-secret-secret-1', '203.0.113.9', 'OWNER')[1]).toBe(keys[1]);
  });
});

describe('crypto helpers', () => {
  it('hashes, compares and generates tokens', () => {
    expect(sha256Hex('a')).toHaveLength(64);
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(randomToken(32)).not.toBe(randomToken(32));
    expect(randomToken(32).length).toBeGreaterThanOrEqual(43);
  });
});
