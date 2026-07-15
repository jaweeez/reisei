import { normalizeUsername, verifySecret } from '@/server/auth/credential';
import { createSession, sessionCookie } from '@/server/auth/session';
import { adminPool, pool } from '@/server/db';

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

// POST /api/auth/login { username, pin, remember? }
export async function POST(req: Request) {
  let b: { username?: unknown; pin?: unknown; remember?: unknown };
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const username = normalizeUsername(typeof b.username === 'string' ? b.username : '');
  const pin = typeof b.pin === 'string' ? b.pin : '';
  // Default to remembered for existing clients that do not yet send this field.
  const remember = b.remember !== false;
  if (!username || !pin) return Response.json({ error: 'Enter your username and PIN.' }, { status: 400 });

  const { rows } = await pool().query(`select * from auth_user_by_username($1)`, [username]);
  const u = rows[0];

  if (u?.pin_locked_until && new Date(u.pin_locked_until) > new Date()) {
    return Response.json({ error: 'Too many tries. Wait a few minutes and try again.' }, { status: 429 });
  }

  // Always run a bcrypt compare (dummy hash if no user) so timing doesn't leak existence.
  const ok = await verifySecret(pin, u?.pin_hash ?? null);
  if (!u || !ok) {
    if (u) await pool().query(`select auth_note_pin_failure($1, $2, $3)`, [u.id, MAX_ATTEMPTS, LOCK_MINUTES]);
    return Response.json({ error: 'Wrong username or PIN.' }, { status: 401 });
  }

  await pool().query(`select auth_clear_pin_failures($1)`, [u.id]);
  const token = await createSession(u.id, req.headers.get('user-agent'), remember);
  const user = (
    await adminPool().query(
      `select id, name, username, tz, plan, email, email_verified as "emailVerified", email_required as "emailRequired"
         from users where id = $1`,
      [u.id],
    )
  ).rows[0];
  return Response.json({ token, user }, { headers: { 'set-cookie': sessionCookie(token, remember) } });
}
