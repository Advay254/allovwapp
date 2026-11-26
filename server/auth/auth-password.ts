import { hash, verify } from '@node-rs/argon2';

// Argon2id with the OWASP minimum cost for interactive logins (19 MiB, 2 passes).
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export async function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

let dummyHash: Promise<string> | null = null;

/** Computes the dummy hash early so the first unknown user login is not noticeably slower. */
export function warmPasswordHashing(): Promise<string> {
  dummyHash ??= hashPassword('allov-timing-equaliser-not-a-real-password');
  return dummyHash;
}

/**
 * Verifies a password. When the user does not exist (stored is null) it still performs a
 * full hash comparison against a dummy hash, so both outcomes take a similar time.
 */
export async function verifyPassword(stored: string | null, password: string): Promise<boolean> {
  if (stored === null) {
    const dummy = await warmPasswordHashing();
    await verify(dummy, password).catch(() => false);
    return false;
  }
  try {
    return await verify(stored, password);
  } catch {
    return false;
  }
}
