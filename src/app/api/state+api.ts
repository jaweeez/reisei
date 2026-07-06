import { currentUser } from '@/server/auth/session';
import { withUser } from '@/server/db';
import { localDateFor } from '@/server/streak';
import type { CrewView, HomeState } from '@/lib/data/types';

// GET /api/state → everything the Today + Crew screens need, RLS-filtered:
// today's check-in status, the streak, and each crew with per-member presence.
export async function GET(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  const state = await withUser<HomeState>(userId, async (c) => {
    const me = (await c.query(`select tz from users where id = current_app_user()`)).rows[0] as { tz?: string } | undefined;
    const today = localDateFor(me?.tz ?? 'UTC');

    const [streakRow, checkedInRow, crewsRes, membersRes, presenceRes] = await Promise.all([
      c.query(
        `select current, longest, to_char(last_local_date, 'YYYY-MM-DD') as last_local_date
           from streaks where user_id = current_app_user()`,
      ),
      c.query(`select 1 from check_ins where user_id = current_app_user() and local_date = $1 limit 1`, [today]),
      c.query(`select id, name, captain_id from crews order by created_at`),
      c.query(
        `select cm.crew_id, cm.user_id, cm.role, u.name
           from crew_members cm join users u on u.id = cm.user_id`,
      ),
      c.query(`select distinct user_id from check_ins where local_date = $1`, [today]),
    ]);

    const streak = streakRow.rows[0] ?? { current: 0, longest: 0, last_local_date: null };
    const checkedIn = new Set<string>(presenceRes.rows.map((r) => r.user_id as string));

    const crews: CrewView[] = crewsRes.rows.map((crew) => {
      const members = membersRes.rows
        .filter((m) => m.crew_id === crew.id)
        .map((m) => ({
          id: m.user_id as string,
          name: m.name as string,
          role: m.role as 'member' | 'captain',
          checkedInToday: checkedIn.has(m.user_id as string),
        }));
      return {
        id: crew.id as string,
        name: crew.name as string,
        isCaptain: crew.captain_id === userId,
        memberCount: members.length,
        checkedInCount: members.filter((m) => m.checkedInToday).length,
        members,
      };
    });

    return {
      localDate: today,
      checkedInToday: checkedInRow.rowCount ? checkedInRow.rowCount > 0 : false,
      streak: {
        current: streak.current ?? 0,
        longest: streak.longest ?? 0,
        lastLocalDate: streak.last_local_date ?? null,
      },
      crews,
    };
  });

  return Response.json(state);
}
