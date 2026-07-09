import { currentUser } from '@/server/auth/session';
import { adminPool } from '@/server/db';
import { cornerSeat, cornerSeatPool } from '@/server/org/store';

// GET  /api/crew/seats → the caller's Corner-plan seat pool ({ pool: null } without one).
// POST /api/crew/seats { crewId, userId, action: 'assign' | 'release' } — the Corner
// captain distributes the seats they bought (plan 'seat', 2–8). Caller must captain the
// crew AND sponsor an active 'seat' subscription; the target must be a member of that crew.
export async function GET(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });
  const pool = await cornerSeatPool(userId);
  return Response.json({ pool });
}
export async function POST(req: Request) {
  const callerId = await currentUser(req);
  if (!callerId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let b: { crewId?: unknown; userId?: unknown; action?: unknown };
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const crewId = typeof b.crewId === 'string' ? b.crewId : '';
  const targetId = typeof b.userId === 'string' ? b.userId : '';
  const action = b.action === 'release' ? 'release' : 'assign';
  if (!crewId || !targetId) return Response.json({ error: 'Missing crewId or userId.' }, { status: 400 });

  const p = adminPool();
  const isCaptain = (
    await p.query(`select 1 from crew_members where crew_id = $1 and user_id = $2 and role = 'captain'`, [crewId, callerId])
  ).rowCount;
  if (!isCaptain) return Response.json({ error: 'Only the captain manages seats.' }, { status: 403 });

  const isMember = (
    await p.query(`select 1 from crew_members where crew_id = $1 and user_id = $2`, [crewId, targetId])
  ).rowCount;
  if (!isMember) return Response.json({ error: 'That person is not in this Corner.' }, { status: 404 });

  const res = await cornerSeat(callerId, targetId, action);
  if (!res.ok) {
    if (res.reason === 'no_sub') {
      return Response.json({ error: 'No Corner seats on your plan. Buy seats to cover your people.', upsell: true }, { status: 402 });
    }
    if (res.reason === 'no_seat') {
      return Response.json({ error: 'No seats open. Add seats in billing.' }, { status: 409 });
    }
    return Response.json({ error: 'That person has no seat to release.' }, { status: 409 });
  }
  return Response.json({ seats: res.seats });
}
