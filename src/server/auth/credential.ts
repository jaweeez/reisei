import bcrypt from 'bcryptjs';

// Username + PIN credentials, bcrypt-hashed (the salt lives in each hash, so no
// extra secret is required). Mirrors the Enso auth model. Passkeys (SimpleWebAuthn)
// are the intended upgrade — see [[muworks-house-stack]].

const BCRYPT_ROUNDS = 10;
const DUMMY_HASH = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8.p9V0oQ8pR3sTq0aQ0aQ0aQ0aQ0a'; // for constant-time login

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Returns an error string if the PIN is invalid, else null. */
export function validatePin(pin: string): string | null {
  if (!/^\d{4,8}$/.test(pin)) return 'PIN must be 4 to 8 digits.';
  return null;
}

/** Returns an error string if invalid, else null. */
export function validateCredentials(username: string, pin: string): string | null {
  if (!/^[a-z0-9_.]{3,24}$/.test(username)) {
    return 'Username must be 3 to 24 chars: letters, numbers, dot or underscore.';
  }
  return validatePin(pin);
}

/** Returns an error string if invalid, else null. */
export function validateEmail(email: string): string | null {
  if (!email) return 'Enter your email.';
  if (email.length > 254) return 'That email is too long.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email.';
  return null;
}

export function hashSecret(secret: string): Promise<string> {
  return bcrypt.hash(secret, BCRYPT_ROUNDS);
}

/** Compare against a hash; always runs a bcrypt compare (dummy if null) to avoid timing leaks. */
export function verifySecret(secret: string, hash: string | null): Promise<boolean> {
  return bcrypt.compare(secret, hash ?? DUMMY_HASH);
}
