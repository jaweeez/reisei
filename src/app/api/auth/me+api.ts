import { currentUser } from '@/server/auth/session';
import { adminPool } from '@/server/db';
import { getEntitlement } from '@/server/entitlement';

// GET /api/auth/me → the signed-in user + their entitlement (tier), or 401.
export async function GET(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  const [user, entitlement] = await Promise.all([
    adminPool()
      .query(`select id, name, username, tz, plan, hold_time as "holdTime" from users where id = $1`, [userId])
      .then((r) => r.rows[0] ?? null),
    getEntitlement(userId),
  ]);
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 });
  return Response.json({ user, entitlement });
}
