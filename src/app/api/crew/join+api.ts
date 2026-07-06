import { currentUser } from '@/server/auth/session';
import { pool } from '@/server/db';

// POST /api/crew/join { code } → join the crew behind an invite code. Free (anyone
// invited can join a crew, per "free to join, pay to lead").
export async function POST(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let b: { code?: unknown };
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const code = typeof b.code === 'string' ? b.code.trim() : '';
  if (!code) return Response.json({ error: 'Enter an invite code.' }, { status: 400 });

  const { rows } = await pool().query(`select crew_join($1, $2) as crew_id`, [userId, code]);
  const crewId = rows[0]?.crew_id as string | null;
  if (!crewId) return Response.json({ error: 'That invite code is invalid.' }, { status: 404 });
  return Response.json({ crewId });
}
