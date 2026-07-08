import { hashSecret, normalizeEmail, normalizeUsername, validateCredentials, validateEmail } from '@/server/auth/credential';
import { createSession, sessionCookie } from '@/server/auth/session';
import { issueCode } from '@/server/auth/codeStore';
import { adminPool, pool } from '@/server/db';

const USER_COLS = `id, name, username, tz, plan, email, email_verified as "emailVerified", email_required as "emailRequired"`;

// POST /api/auth/register { username, pin, name?, email }
// Email is REQUIRED for new accounts: we store it unverified (email_required=true) and send a
// 6-digit code. The client then lands on the verify-email wall until it's verified.
export async function POST(req: Request) {
  let b: { username?: unknown; pin?: unknown; name?: unknown; email?: unknown };
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const username = normalizeUsername(typeof b.username === 'string' ? b.username : '');
  const pin = typeof b.pin === 'string' ? b.pin : '';
  const name = typeof b.name === 'string' ? b.name : '';
  const email = normalizeEmail(typeof b.email === 'string' ? b.email : '');

  const invalid = validateCredentials(username, pin);
  if (invalid) return Response.json({ error: invalid }, { status: 400 });
  const emailErr = validateEmail(email);
  if (emailErr) return Response.json({ error: emailErr }, { status: 400 });

  const pinHash = await hashSecret(pin);
  const { rows } = await pool().query(`select auth_register_user($1, $2, $3, $4) as id`, [username, name, pinHash, email]);
  const userId = rows[0]?.id as string | null;
  if (!userId) {
    // username OR email taken — disambiguate for a clear error.
    const emailTaken = (await adminPool().query(`select exists(select 1 from users where email = $1) as taken`, [email])).rows[0]?.taken;
    return Response.json({ error: emailTaken ? 'That email is already in use.' : 'That username is taken.' }, { status: 409 });
  }

  const token = await createSession(userId, req.headers.get('user-agent'));
  const user = (await adminPool().query(`select ${USER_COLS} from users where id = $1`, [userId])).rows[0];
  // Send the verification code (best-effort; the user can resend from the wall).
  try {
    await issueCode(adminPool(), userId, email, 'verify_email');
  } catch (e) {
    console.error('verify code send failed:', e instanceof Error ? e.message : e);
  }
  return Response.json({ token, user }, { headers: { 'set-cookie': sessionCookie(token) } });
}
