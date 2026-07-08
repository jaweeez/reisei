import { hashSecret, normalizeEmail, validatePin } from '@/server/auth/credential';
import { checkCode } from '@/server/auth/codeStore';
import { revokeAllSessions } from '@/server/auth/session';
import { adminPool } from '@/server/db';

// POST /api/auth/pin-reset/confirm { email, code, pin } — verify the reset code, set the new
// PIN, and revoke all existing sessions. Generic errors so nothing leaks account existence.
export async function POST(req: Request) {
  let b: { email?: unknown; code?: unknown; pin?: unknown } = {};
  try {
    b = await req.json();
  } catch {
    /* validated below */
  }
  const email = normalizeEmail(typeof b.email === 'string' ? b.email : '');
  const code = typeof b.code === 'string' ? b.code.trim() : '';
  const pin = typeof b.pin === 'string' ? b.pin : '';

  const pinErr = validatePin(pin);
  if (pinErr) return Response.json({ error: pinErr }, { status: 400 });
  if (!email || !/^\d{6}$/.test(code)) return Response.json({ error: 'Check your code and try again.' }, { status: 400 });

  const u = (await adminPool().query(`select id, email_verified as verified from auth_user_by_email($1)`, [email])).rows[0];
  if (!u?.id || !u.verified) return Response.json({ error: 'That code is wrong or expired.' }, { status: 400 });

  const res = await checkCode(adminPool(), u.id as string, 'pin_reset', code);
  if (!res.ok) return Response.json({ error: 'That code is wrong or expired.' }, { status: 400 });

  await adminPool().query(`select auth_set_pin($1, $2)`, [u.id, await hashSecret(pin)]);
  await revokeAllSessions(u.id as string);
  return Response.json({ ok: true });
}
