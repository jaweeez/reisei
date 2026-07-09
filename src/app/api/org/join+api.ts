import { currentUser } from '@/server/auth/session';
import { pool } from '@/server/db';
import { mapJoinNote } from '@/server/org/logic';

// POST /api/org/join { code } → join an organization by its invite code. The org_join
// SQL function is atomic: it assigns a seat (making the joiner premium), records org
// membership, and lands them in the invite's Corner if one is set and has room.
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

  const { rows } = await pool().query(`select * from org_join($1, $2)`, [userId, code]);
  const r = rows[0] as { org_id: string; crew_id: string | null; seated: boolean; note: string } | undefined;
  if (!r) return Response.json({ error: 'That invite code is invalid.' }, { status: 404 });

  const mapped = mapJoinNote(r.note);
  if (mapped.status !== 200) return Response.json({ error: mapped.error }, { status: mapped.status });

  return Response.json({
    orgId: r.org_id,
    crewId: r.crew_id,
    seated: r.seated,
    cornerFull: r.note === 'corner_full',
  });
}
