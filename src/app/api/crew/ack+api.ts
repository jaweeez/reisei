import { currentUser } from '@/server/auth/session';
import { withUser } from '@/server/db';
import { localDateFor } from '@/server/streak';

// POST /api/crew/ack { crewId, toUserId, kind } → a structured, one-tap acknowledgment.
// kind ∈ seen | respect | stand_up. Rate-limited to one per pair per day per kind by
// the unique index. RLS enforces you're a member of the crew and acking as yourself.
const KINDS = new Set(['seen', 'respect', 'stand_up']);

export async function POST(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let b: { crewId?: unknown; toUserId?: unknown; kind?: unknown };
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const crewId = typeof b.crewId === 'string' ? b.crewId : '';
  const toUserId = typeof b.toUserId === 'string' ? b.toUserId : '';
  const kind = typeof b.kind === 'string' && KINDS.has(b.kind) ? b.kind : '';
  if (!crewId || !toUserId || !kind) return Response.json({ error: 'crewId, toUserId, kind required.' }, { status: 400 });
  if (toUserId === userId) return Response.json({ error: 'You can’t ack yourself.' }, { status: 400 });

  const inserted = await withUser(userId, async (c) => {
    const tz = (await c.query(`select tz from users where id = current_app_user()`)).rows[0]?.tz ?? 'UTC';
    return (await c.query(
      `insert into crew_acks (crew_id, from_user_id, to_user_id, local_date, kind)
       values ($1, current_app_user(), $2, $3, $4)
       on conflict (crew_id, from_user_id, to_user_id, local_date, kind) do nothing
       returning id`,
      [crewId, toUserId, localDateFor(tz), kind],
    )).rowCount;
  });

  // STAND UP nudges the target — the push fires from the P8 coach engine
  // (nudges kind 'stand_up'); recording the ack here is the trigger of record.
  return Response.json({ ok: true, created: Boolean(inserted) });
}
