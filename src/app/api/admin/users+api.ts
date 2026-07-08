import { adminUserId, forbidden } from '@/server/auth/admin';
import { adminPool } from '@/server/db';

// GET /api/admin/users?q=&limit= → users for the admin dashboard, newest first. Owner role
// (RLS-bypassed), admin-gated. Optional case-insensitive search over username + name.
export async function GET(req: Request) {
  if (!(await adminUserId(req))) return forbidden();

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 100) || 100, 1), 200);

  const { rows } = await adminPool().query(
    `select u.id,
            u.username,
            u.name,
            u.plan,
            u.is_admin as "isAdmin",
            to_char(u.created_at, 'YYYY-MM-DD') as "createdAt",
            (select count(*) from crew_members cm where cm.user_id = u.id)::int as "crewCount"
       from users u
      where ($1 = '' or u.username ilike $2 or u.name ilike $2)
      order by u.created_at desc
      limit $3`,
    [q, `%${q}%`, limit],
  );
  return Response.json({ users: rows });
}
