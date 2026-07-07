import { currentUser } from '@/server/auth/session';
import { withUser } from '@/server/db';
import { localDateFor } from '@/server/streak';
import type { CrewView, HomeState, LineView, Verdict } from '@/lib/data/types';

// GET /api/state → everything Today + Crew need, RLS-filtered: the active line,
// today's verdict, the streak (+ integrity), and each crew with per-member posture.
export async function GET(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  const state = await withUser<HomeState>(userId, async (c) => {
    const me = (await c.query(`select tz from users where id = current_app_user()`)).rows[0] as { tz?: string } | undefined;
    const today = localDateFor(me?.tz ?? 'UTC');

    const [lineRes, todayRes, streakRes, crewsRes, membersRes, memberLinesRes, verdictsRes, acksRes, nudgeRes, resetRes] =
      await Promise.all([
      c.query(
        `select id, statement, kind, to_char(start_local_date,'YYYY-MM-DD') as "startLocalDate"
           from lines where user_id = current_app_user() and status = 'active' limit 1`,
      ),
      c.query(`select verdict from check_ins where user_id = current_app_user() and local_date = $1`, [today]),
      c.query(
        `select current, longest, to_char(last_local_date,'YYYY-MM-DD') as last_local_date,
                last_verdict, breaks, resets, integrity
           from streaks where user_id = current_app_user()`,
      ),
      c.query(`select id, name, captain_id from crews order by created_at`),
      c.query(`select cm.crew_id, cm.user_id, cm.role, u.name from crew_members cm join users u on u.id = cm.user_id`),
      c.query(`select user_id, statement from lines where status = 'active'`),
      c.query(`select user_id, verdict from check_ins where local_date = $1`, [today]),
      c.query(`select from_user_id, to_user_id from crew_acks where local_date = $1`, [today]),
      c.query(`select body from nudges where user_id = current_app_user() and local_date = $1 order by sent_at desc limit 1`, [today]),
      c.query(`select 1 from practices where user_id = current_app_user() and kind = 'reset' and local_date = $1 limit 1`, [today]),
    ]);

    const line = (lineRes.rows[0] as LineView | undefined) ?? null;
    const s = streakRes.rows[0] ?? {};
    const lineByUser = new Map<string, string>(memberLinesRes.rows.map((r) => [r.user_id as string, r.statement as string]));
    const verdictByUser = new Map<string, Verdict>(verdictsRes.rows.map((r) => [r.user_id as string, r.verdict as Verdict]));
    const acksReceived = new Map<string, number>();
    const ackedByMe = new Set<string>();
    for (const r of acksRes.rows) {
      const to = r.to_user_id as string;
      acksReceived.set(to, (acksReceived.get(to) ?? 0) + 1);
      if (r.from_user_id === userId) ackedByMe.add(to);
    }

    const crews: CrewView[] = crewsRes.rows.map((crew) => {
      const members = membersRes.rows
        .filter((m) => m.crew_id === crew.id)
        .map((m) => {
          const uid = m.user_id as string;
          const v = verdictByUser.get(uid);
          const posture: 'held' | 'broke' | 'dark' = v === 'held' ? 'held' : v === 'broke' ? 'broke' : 'dark';
          return {
            id: uid,
            name: m.name as string,
            role: m.role as 'member' | 'captain',
            posture,
            line: lineByUser.get(uid) ?? null,
            acksReceived: acksReceived.get(uid) ?? 0,
            ackedByMe: ackedByMe.has(uid),
          };
        });
      return {
        id: crew.id as string,
        name: crew.name as string,
        isCaptain: crew.captain_id === userId,
        memberCount: members.length,
        heldCount: members.filter((m) => m.posture === 'held').length,
        brokeCount: members.filter((m) => m.posture === 'broke').length,
        members,
      };
    });

    return {
      localDate: today,
      line,
      todayVerdict: ((todayRes.rows[0]?.verdict as Verdict) ?? null),
      streak: {
        current: Number(s.current ?? 0),
        longest: Number(s.longest ?? 0),
        lastLocalDate: (s.last_local_date as string) ?? null,
        lastVerdict: (s.last_verdict as Verdict) ?? null,
        breaks: Number(s.breaks ?? 0),
        resets: Number(s.resets ?? 0),
        integrity: Number(s.integrity ?? 0),
      },
      crews,
      todayNudge: (nudgeRes.rows[0]?.body as string) ?? null,
      resetToday: (resetRes.rowCount ?? 0) > 0,
    };
  });

  return Response.json(state);
}
