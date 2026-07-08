import { adminUserId, forbidden } from '@/server/auth/admin';
import { adminPool } from '@/server/db';

// POST /api/admin/grant { userId, plan: 'free' | 'pro' } → set a user's individual plan.
// Admin only, owner role. (users.plan is CHECK-constrained to free|pro; team is seat-derived
// and not settable here.)
export async function POST(req: Request) {
  if (!(await adminUserId(req))) return forbidden();

  let b: { userId?: unknown; plan?: unknown };
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const userId = typeof b.userId === 'string' ? b.userId : '';
  const plan = b.plan === 'pro' ? 'pro' : b.plan === 'free' ? 'free' : null;
  if (!userId || !plan) {
    return Response.json({ error: 'userId and plan (free|pro) are required' }, { status: 400 });
  }

  const { rowCount } = await adminPool().query(`update users set plan = $2 where id = $1`, [userId, plan]);
  if (!rowCount) return Response.json({ error: 'no such user' }, { status: 404 });
  return Response.json({ ok: true, userId, plan });
}
