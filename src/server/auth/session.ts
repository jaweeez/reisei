import { randomBytes } from 'node:crypto';
import { pool } from '../db';

// Opaque, server-side, revocable sessions (mirrors the MuWorks session model). The
// token is a 64-hex random string used as a Bearer credential (native) or an
// httpOnly cookie value (web). `sessions` is auth-infrastructure (not under RLS).

const SESSION_TTL_DAYS = 30;
export const SESSION_COOKIE = 'reisei_session';
export const SESSION_TTL_SECONDS = SESSION_TTL_DAYS * 86_400;

export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export async function createSession(userId: string, userAgent?: string | null): Promise<string> {
  const token = generateToken();
  await pool().query(
    `insert into sessions (token, user_id, expires_at, user_agent)
     values ($1, $2, now() + ($3 || ' seconds')::interval, $4)`,
    [token, userId, String(SESSION_TTL_SECONDS), userAgent ?? null],
  );
  return token;
}

/** Resolve a token to its user id, or null if missing/invalid/expired. Touches last_seen_at. */
export async function userForToken(token: string | null | undefined): Promise<string | null> {
  if (!token) return null;
  const { rows } = await pool().query(
    `update sessions set last_seen_at = now()
      where token = $1 and expires_at > now()
      returning user_id`,
    [token],
  );
  return rows[0]?.user_id ?? null;
}

export async function revokeSession(token: string | null | undefined): Promise<void> {
  if (!token) return;
  try {
    await pool().query(`delete from sessions where token = $1`, [token]);
  } catch {
    /* best-effort: never let logout fail because revocation hiccuped */
  }
}

/** Revoke every session for a user (e.g. after a PIN reset). Index-backed on sessions_user_id_idx. */
export async function revokeAllSessions(userId: string): Promise<void> {
  await pool().query(`delete from sessions where user_id = $1`, [userId]);
}

/** The Set-Cookie value for a new session (web; native uses the Bearer token). */
export function sessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`;
}

/** The Set-Cookie value that clears the session cookie (logout). */
export function clearedCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

/** Read the session token from a request: Bearer header (native) or cookie (web). */
export function tokenFromRequest(req: Request): string | null {
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim() || null;
  const cookie = req.headers.get('cookie');
  if (cookie) {
    const m = cookie.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`));
    if (m?.[1]) return decodeURIComponent(m[1]);
  }
  return null;
}

/** Convenience: resolve the acting user id straight from the request. */
export async function currentUser(req: Request): Promise<string | null> {
  return userForToken(tokenFromRequest(req));
}
