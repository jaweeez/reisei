import { randomInt } from 'node:crypto';

// One-time 6-digit codes for email verification + PIN reset. The helpers here are pure and
// unit-tested; the DB I/O (the auth_codes table) lives in the auth routes. There is no
// general rate-limit infra in the repo, so cost/abuse control is DB-backed and modeled on
// the PIN lockout: a resend cooldown, a daily send cap, and a per-code attempt cap.

export const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const RESEND_COOLDOWN_MS = 60 * 1000; // 60s between sends
export const DAILY_SEND_CAP = 8; // per user, per purpose, per rolling day
export const MAX_CODE_ATTEMPTS = 5; // wrong tries before a code is dead

/** A uniform 6-digit numeric code, zero-padded (e.g. "004217"). */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Seconds left on the resend cooldown given the last send time, or 0 if clear. */
export function cooldownRemaining(lastSentAtMs: number | null, nowMs: number, cooldownMs = RESEND_COOLDOWN_MS): number {
  if (!lastSentAtMs) return 0;
  const remaining = Math.ceil((lastSentAtMs + cooldownMs - nowMs) / 1000);
  return remaining > 0 ? remaining : 0;
}

/** Whether another send is allowed under the daily cap. */
export function underDailyCap(sentTodayCount: number, cap = DAILY_SEND_CAP): boolean {
  return sentTodayCount < cap;
}
