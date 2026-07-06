import { adminPool } from '@/server/db';
import { localDateFor } from '@/server/streak';
import { holdHourOf, pickNudge } from '@/server/coach/nudges';
import { sendExpoPush } from '@/server/push';

// GET /api/coach/tick — the coach cron (hourly, via vercel.json crons). Selects users
// whose LOCAL time crosses a trigger window, computes at most one nudge each (one push
// per user per day), records it in `nudges` idempotently, and dispatches Expo push.
// Secured by CRON_SECRET (Vercel sets Authorization: Bearer <CRON_SECRET> on cron runs).

function localHourFor(tz: string, at: Date): number {
  try {
    return Number(new Intl.DateTimeFormat('en-US', { timeZone: tz || 'UTC', hour: 'numeric', hour12: false }).format(at)) % 24;
  } catch {
    return at.getUTCHours();
  }
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: 'CRON_SECRET not configured.' }, { status: 503 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const yesterdayUtc = new Date(now.getTime() - 86_400_000);
  const p = adminPool();

  const [candidates, nudgedToday, standUps] = await Promise.all([
    p.query(
      `select u.id, u.tz, u.hold_time, u.name,
              coalesce(s.current, 0) as current, s.last_verdict,
              to_char(s.last_local_date, 'YYYY-MM-DD') as last_local_date
         from users u
         join lines l on l.user_id = u.id and l.status = 'active'
         left join streaks s on s.user_id = u.id`,
    ),
    p.query(`select distinct user_id from nudges where local_date >= current_date - 1`),
    p.query(`select distinct to_user_id from crew_acks where kind = 'stand_up' and local_date >= current_date - 1`),
  ]);

  const alreadyNudged = new Set<string>(nudgedToday.rows.map((r) => r.user_id as string));
  const standUpSet = new Set<string>(standUps.rows.map((r) => r.to_user_id as string));

  let sent = 0;
  for (const u of candidates.rows) {
    const id = u.id as string;
    if (alreadyNudged.has(id)) continue; // one push per user per day
    const tz = (u.tz as string) || 'UTC';
    const today = localDateFor(tz, now);
    const yesterday = localDateFor(tz, yesterdayUtc);
    const last = (u.last_local_date as string) ?? null;
    const loggedToday = last === today;

    const nudge = pickNudge({
      name: (u.name as string) ?? 'you',
      localHour: localHourFor(tz, now),
      holdHour: holdHourOf(u.hold_time as string),
      loggedToday,
      current: Number(u.current ?? 0),
      brokeYesterday: last === yesterday && u.last_verdict === 'broke',
      missedYesterday: last != null && last !== yesterday && !loggedToday,
      hasStandUp: standUpSet.has(id),
    });
    if (!nudge) continue;

    try {
      const ins = await p.query(
        `insert into nudges (user_id, kind, local_date, body, channel)
         values ($1, $2, $3, $4, 'push')
         on conflict (user_id, kind, local_date) do nothing
         returning id`,
        [id, nudge.kind, today, nudge.body],
      );
      if (!ins.rowCount) continue;
      const tokens = (await p.query(`select token from device_tokens where user_id = $1`, [id])).rows.map((r) => r.token as string);
      const n = await sendExpoPush(tokens.map((t) => ({ to: t, title: 'Reisei', body: nudge.body, data: { kind: nudge.kind } })));
      if (n > 0 || tokens.length === 0) sent += 1;
    } catch (e) {
      console.error('tick error for user', id, e instanceof Error ? e.message : e);
    }
  }

  return Response.json({ checked: candidates.rowCount, nudged: sent });
}
