import { currentUser } from '@/server/auth/session';
import { issueCode } from '@/server/auth/codeStore';
import { adminPool } from '@/server/db';

// POST /api/auth/email/resend — resend the verification code (cooldown + daily cap enforced).
export async function POST(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  const email = (await adminPool().query(`select email from users where id = $1`, [userId])).rows[0]?.email as string | undefined;
  if (!email) return Response.json({ error: 'Add an email first.' }, { status: 400 });

  const issued = await issueCode(adminPool(), userId, email, 'verify_email');
  if (issued.ok) return Response.json({ ok: true });
  if ('cooldown' in issued) return Response.json({ error: `Wait ${issued.cooldown}s before resending.`, cooldown: issued.cooldown }, { status: 429 });
  return Response.json({ error: 'Too many codes today. Try again tomorrow.' }, { status: 429 });
}
