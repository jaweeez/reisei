import { normalizeEmail } from '@/server/auth/credential';
import { issueCode } from '@/server/auth/codeStore';
import { adminPool } from '@/server/db';

// POST /api/auth/pin-reset/request { email } — if the email maps to a VERIFIED account, send a
// reset code. ALWAYS returns a generic ok so nothing leaks whether an account exists.
export async function POST(req: Request) {
  let b: { email?: unknown } = {};
  try {
    b = await req.json();
  } catch {
    /* generic ok below */
  }
  const email = normalizeEmail(typeof b.email === 'string' ? b.email : '');
  if (email) {
    try {
      const u = (await adminPool().query(`select id, email_verified as verified from auth_user_by_email($1)`, [email])).rows[0];
      if (u?.id && u.verified) await issueCode(adminPool(), u.id as string, email, 'pin_reset');
    } catch (e) {
      console.error('pin-reset request:', e instanceof Error ? e.message : e);
    }
  }
  return Response.json({ ok: true });
}
