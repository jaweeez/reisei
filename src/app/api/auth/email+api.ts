import { normalizeEmail, validateEmail } from '@/server/auth/credential';
import { currentUser } from '@/server/auth/session';
import { issueCode } from '@/server/auth/codeStore';
import { adminPool } from '@/server/db';

// POST /api/auth/email { email } — add or change the signed-in user's email (unverified),
// then send a verification code. Used by existing users opting in and by anyone changing it.
export async function POST(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let b: { email?: unknown } = {};
  try {
    b = await req.json();
  } catch {
    /* validated below */
  }
  const email = normalizeEmail(typeof b.email === 'string' ? b.email : '');
  const err = validateEmail(email);
  if (err) return Response.json({ error: err }, { status: 400 });

  const set = (await adminPool().query(`select auth_set_email($1, $2) as ok`, [userId, email])).rows[0];
  if (!set?.ok) return Response.json({ error: 'That email is already in use.' }, { status: 409 });

  const issued = await issueCode(adminPool(), userId, email, 'verify_email');
  if (issued.ok) return Response.json({ ok: true });
  if ('cooldown' in issued) return Response.json({ ok: true, cooldown: issued.cooldown });
  return Response.json({ ok: true, capped: true });
}
