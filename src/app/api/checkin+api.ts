import { currentUser } from '@/server/auth/session';
import { withUser } from '@/server/db';
import { applyCheckIn, localDateFor, ZERO_STREAK, type StreakState, type Verdict } from '@/server/streak';

// POST /api/checkin { verdict?, note? } → log today's verdict against the active line
// (idempotent per local day) and roll the streak forward in the SAME transaction.
// Also appends to the line_events ledger. verdict defaults to 'held'.

function rowToStreak(r: Record<string, unknown> | undefined): StreakState {
  if (!r) return ZERO_STREAK;
  return {
    current: Number(r.current ?? 0),
    longest: Number(r.longest ?? 0),
    lastLocalDate: (r.last_local_date as string) ?? null,
    lastVerdict: (r.last_verdict as Verdict) ?? null,
    breaks: Number(r.breaks ?? 0),
    resets: Number(r.resets ?? 0),
    integrity: Number(r.integrity ?? 0),
  };
}

export async function POST(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let b: { verdict?: unknown; note?: unknown } = {};
  try {
    b = await req.json();
  } catch {
    /* body optional */
  }
  const verdict: Verdict = b.verdict === 'broke' ? 'broke' : 'held';
  const note = typeof b.note === 'string' ? b.note.trim().slice(0, 140) || null : null;

  const result = await withUser(userId, async (c) => {
    const me = (await c.query(`select tz from users where id = current_app_user()`)).rows[0] as { tz?: string } | undefined;
    const today = localDateFor(me?.tz ?? 'UTC');

    const line = (await c.query(
      `select id from lines where user_id = current_app_user() and status = 'active' limit 1`,
    )).rows[0] as { id?: string } | undefined;
    if (!line?.id) return { noLine: true as const };

    const inserted = await c.query(
      `insert into check_ins (user_id, line_id, verdict, note, local_date)
       values (current_app_user(), $1, $2, $3, $4)
       on conflict (user_id, local_date) do nothing
       returning id`,
      [line.id, verdict, note, today],
    );

    const prev = rowToStreak(
      (await c.query(
        `select current, longest, to_char(last_local_date,'YYYY-MM-DD') as last_local_date,
                last_verdict, breaks, resets, integrity
           from streaks where user_id = current_app_user()`,
      )).rows[0],
    );

    // Already logged today → verdict is locked; return what stands.
    if (!inserted.rowCount) {
      const existing = (await c.query(
        `select verdict from check_ins where user_id = current_app_user() and local_date = $1`,
        [today],
      )).rows[0] as { verdict?: Verdict } | undefined;
      return { alreadyCheckedIn: true as const, todayVerdict: existing?.verdict ?? prev.lastVerdict, localDate: today, streak: prev };
    }

    const next = applyCheckIn(prev, today, verdict);
    await c.query(
      `insert into streaks (user_id, current, longest, last_local_date, last_verdict, breaks, resets, integrity)
       values (current_app_user(), $1, $2, $3, $4, $5, $6, $7)
       on conflict (user_id) do update set
         current = excluded.current, longest = excluded.longest, last_local_date = excluded.last_local_date,
         last_verdict = excluded.last_verdict, breaks = excluded.breaks, resets = excluded.resets, integrity = excluded.integrity`,
      [next.current, next.longest, next.lastLocalDate, next.lastVerdict, next.breaks, next.resets, next.integrity],
    );
    await c.query(
      `insert into line_events (line_id, user_id, local_date, verdict, note)
       values ($1, current_app_user(), $2, $3, $4)
       on conflict (line_id, local_date) do nothing`,
      [line.id, today, verdict, note],
    );
    return { alreadyCheckedIn: false as const, todayVerdict: verdict, localDate: today, streak: next };
  });

  if ('noLine' in result) return Response.json({ error: 'Draw a line first.' }, { status: 400 });

  const s = result.streak;
  return Response.json({
    alreadyCheckedIn: result.alreadyCheckedIn,
    todayVerdict: result.todayVerdict,
    localDate: result.localDate,
    streak: {
      current: s.current, longest: s.longest, lastLocalDate: s.lastLocalDate, lastVerdict: s.lastVerdict,
      breaks: s.breaks, resets: s.resets, integrity: s.integrity,
    },
  });
}
