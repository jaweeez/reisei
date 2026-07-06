import { randomBytes } from 'node:crypto';
import { currentUser } from '@/server/auth/session';
import { pool } from '@/server/db';

// POST /api/crew/invite { crewId } → mint a share code for a crew you captain.
function makeCode(): string {
  // 8 chars, unambiguous alphabet (no 0/O/1/I).
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

export async function POST(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let b: { crewId?: unknown };
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const crewId = typeof b.crewId === 'string' ? b.crewId : '';
  if (!crewId) return Response.json({ error: 'Missing crewId.' }, { status: 400 });

  const code = makeCode();
  const { rows } = await pool().query(`select crew_create_invite($1, $2, $3) as ok`, [userId, crewId, code]);
  if (!rows[0]?.ok) return Response.json({ error: 'Only the captain can invite.' }, { status: 403 });
  return Response.json({ code });
}
