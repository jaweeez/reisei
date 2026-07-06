import { currentUser } from '@/server/auth/session';
import { withUser } from '@/server/db';
import { applyCheckIn, localDateFor, type StreakState } from '@/server/streak';

// POST /api/checkin { note?, crewId? } → logs today's check-in (idempotent per local
// day) and rolls the streak forward in the SAME transaction. Returns the new streak.
export async function POST(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let b: { note?: unknown; crewId?: unknown } = {};
  try {
    b = await req.json();
  } catch {
    /* body optional */
  }
  const note = typeof b.note === 'string' ? b.note.slice(0, 500) : null;
  const crewId = typeof b.crewId === 'string' ? b.crewId : null;

  const result = await withUser(userId, async (c) => {
    const me = (await c.query(`select tz from users where id = current_app_user()`)).rows[0] as { tz?: string } | undefined;
    const today = localDateFor(me?.tz ?? 'UTC');

    const inserted = await c.query(
      `insert into check_ins (user_id, crew_id, note, local_date)
       values (current_app_user(), $1, $2, $3)
       on conflict (user_id, local_date) do nothing
       returning id`,
      [crewId, note, today],
    );

    const prevRow = (await c.query(
      `select current, longest, last_local_date from streaks where user_id = current_app_user()`,
    )).rows[0];
    const prev: StreakState = {
      current: prevRow?.current ?? 0,
      longest: prevRow?.longest ?? 0,
      lastLocalDate: prevRow?.last_local_date ?? null,
    };

    // Already logged today → return the streak unchanged.
    if (!inserted.rowCount) {
      return { alreadyCheckedIn: true, localDate: today, streak: prev };
    }

    const next = applyCheckIn(prev, today);
    await c.query(
      `insert into streaks (user_id, current, longest, last_local_date)
       values (current_app_user(), $1, $2, $3)
       on conflict (user_id) do update
         set current = excluded.current, longest = excluded.longest, last_local_date = excluded.last_local_date`,
      [next.current, next.longest, next.lastLocalDate],
    );
    return { alreadyCheckedIn: false, localDate: today, streak: next };
  });

  return Response.json({
    ...result,
    streak: {
      current: result.streak.current,
      longest: result.streak.longest,
      lastLocalDate: result.streak.lastLocalDate,
    },
  });
}
