import { currentUser } from '@/server/auth/session';
import { checkCode } from '@/server/auth/codeStore';
import { adminPool } from '@/server/db';

// POST /api/auth/email/verify { code } — verify the latest email code and mark it verified.
export async function POST(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let b: { code?: unknown } = {};
  try {
    b = await req.json();
  } catch {
    /* validated below */
  }
  const code = typeof b.code === 'string' ? b.code.trim() : '';
  if (!/^\d{6}$/.test(code)) return Response.json({ error: 'Enter the 6-digit code.' }, { status: 400 });

  const res = await checkCode(adminPool(), userId, 'verify_email', code);
  if (!res.ok) return Response.json({ error: 'That code is wrong or expired.' }, { status: 400 });

  await adminPool().query(`select auth_verify_email($1, $2)`, [userId, res.email]);
  return Response.json({ ok: true });
}
