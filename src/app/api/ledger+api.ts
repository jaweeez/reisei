import { currentUser } from '@/server/auth/session';
import { withUser } from '@/server/db';
import { getEntitlement } from '@/server/entitlement';

// GET /api/ledger → the Pro "Ledger": the shape of the trained mind. Hold calendar,
// stats (hold-rate, break-clustering by weekday), retired-lines archive, field reports.
// Gated on entitlement.premium — the Pro paywall stands on earned depth.

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export async function GET(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  const ent = await getEntitlement(userId);
  if (!ent.premium) return Response.json({ error: 'The Ledger is a Pro feature.', upsell: true }, { status: 402 });

  const data = await withUser(userId, async (c) => {
    const [events, streak, retired] = await Promise.all([
      c.query(
        `select to_char(local_date,'YYYY-MM-DD') as date, verdict, note
           from line_events where user_id = current_app_user()
          order by local_date desc limit 400`,
      ),
      c.query(`select longest, resets, integrity from streaks where user_id = current_app_user()`),
      c.query(
        `select statement, to_char(start_local_date,'YYYY-MM-DD') as start,
                to_char(retired_local_date,'YYYY-MM-DD') as retired
           from lines where user_id = current_app_user() and status = 'retired'
          order by retired_local_date desc nulls last limit 50`,
      ),
    ]);

    const rows = events.rows as { date: string; verdict: 'held' | 'broke'; note: string | null }[];
    const held = rows.filter((r) => r.verdict === 'held').length;
    const broke = rows.filter((r) => r.verdict === 'broke').length;
    const total = held + broke;

    // Break-clustering by weekday (reconnaissance: "breaks cluster on Fridays").
    const breaksByWeekday = [0, 0, 0, 0, 0, 0, 0];
    for (const r of rows) {
      if (r.verdict === 'broke') breaksByWeekday[new Date(`${r.date}T00:00:00Z`).getUTCDay()] += 1;
    }
    const worstIdx = breaksByWeekday.indexOf(Math.max(...breaksByWeekday));

    const s = streak.rows[0] ?? {};
    return {
      calendar: rows.map((r) => ({ date: r.date, verdict: r.verdict })), // most-recent-first
      stats: {
        held,
        broke,
        holdRate: total ? Math.round((held / total) * 100) : null,
        longest: Number(s.longest ?? 0),
        resets: Number(s.resets ?? 0),
        integrity: Number(s.integrity ?? 0),
        worstDay: broke > 0 && breaksByWeekday[worstIdx] > 0 ? DOW[worstIdx] : null,
        breaksByWeekday,
      },
      retiredLines: retired.rows,
      fieldReports: rows.filter((r) => r.note).map((r) => ({ date: r.date, verdict: r.verdict, note: r.note })),
    };
  });

  return Response.json(data);
}
