import { currentUser } from '@/server/auth/session';
import { withUser } from '@/server/db';
import { localDateFor } from '@/server/streak';
import { RECOVERY_FRICTIONS, type RecoveryFriction } from '@/lib/data/types';

// POST /api/recovery { friction, move } → turn an honest break into tomorrow's move.
// Plans are private and only exist for a logged break on the current local day.
export async function POST(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let body: { friction?: unknown; move?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Choose what got in the way and your next move.' }, { status: 400 });
  }

  const friction = typeof body.friction === 'string' && RECOVERY_FRICTIONS.includes(body.friction as RecoveryFriction)
    ? (body.friction as RecoveryFriction)
    : null;
  const move = typeof body.move === 'string' ? body.move.trim().slice(0, 140) : '';
  if (!friction || move.length < 2) {
    return Response.json({ error: 'Choose what got in the way and your next move.' }, { status: 400 });
  }

  const result = await withUser(userId, async (c) => {
    const me = (await c.query(`select tz from users where id = current_app_user()`)).rows[0] as { tz?: string } | undefined;
    const today = localDateFor(me?.tz ?? 'UTC');
    const breakRow = (await c.query(
      `select l.id
         from lines l
         join check_ins ci on ci.line_id = l.id
        where l.user_id = current_app_user() and l.status = 'active'
          and ci.user_id = current_app_user() and ci.local_date = $1 and ci.verdict = 'broke'
        limit 1`,
      [today],
    )).rows[0] as { id?: string } | undefined;
    if (!breakRow?.id) return null;

    const plan = (await c.query(
      `insert into recovery_plans (user_id, line_id, source_local_date, friction, move)
       values (current_app_user(), $1, $2, $3, $4)
       on conflict (user_id, source_local_date) do update set
         friction = excluded.friction, move = excluded.move, updated_at = now()
       returning to_char(source_local_date, 'YYYY-MM-DD') as "sourceDate", friction, move`,
      [breakRow.id, today, friction, move],
    )).rows[0];
    return plan;
  });

  if (!result) return Response.json({ error: 'Log an honest break first.' }, { status: 400 });
  return Response.json({ plan: result });
}
