import { currentUser } from '@/server/auth/session';
import { adminPool } from '@/server/db';
import { orgOwnedBy, orgSeat } from '@/server/org/store';

// POST /api/org/seats { userId, action: 'assign' | 'release' } — the org owner places
// seats. Target must already be an org member (they arrive via the org invite; the owner
// can re-seat someone who lost a seat, or free a seat up).
export async function POST(req: Request) {
  const callerId = await currentUser(req);
  if (!callerId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  const org = await orgOwnedBy(callerId);
  if (!org) return Response.json({ error: 'You do not run an organization.' }, { status: 404 });

  let b: { userId?: unknown; action?: unknown };
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const targetId = typeof b.userId === 'string' ? b.userId : '';
  const action = b.action === 'release' ? 'release' : 'assign';
  if (!targetId) return Response.json({ error: 'Missing userId.' }, { status: 400 });

  const isMember = (
    await adminPool().query(`select 1 from org_members where org_id = $1 and user_id = $2`, [org.id, targetId])
  ).rowCount;
  if (!isMember) return Response.json({ error: 'That person is not in your organization.' }, { status: 404 });

  const res = await orgSeat(org.id, targetId, action);
  if (!res.ok) {
    if (res.reason === 'no_sub') {
      return Response.json({ error: "Your organization's plan is inactive. Renew it in billing." }, { status: 409 });
    }
    if (res.reason === 'no_seat') {
      return Response.json({ error: 'No seats open. Add seats in billing.' }, { status: 409 });
    }
    return Response.json({ error: 'That person has no seat to release.' }, { status: 409 });
  }
  return Response.json({ seats: res.seats });
}
