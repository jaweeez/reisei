import { adminUserId, forbidden } from '@/server/auth/admin';
import { adminPool } from '@/server/db';

// GET /api/admin/overview → platform totals for the admin dashboard. Owner role (RLS-bypassed),
// admin-gated. Counts are cheap enough at this scale to compute live.
export async function GET(req: Request) {
  if (!(await adminUserId(req))) return forbidden();

  const { rows } = await adminPool().query<Record<string, string>>(
    `select
        (select count(*) from users)                                             as users,
        (select count(*) from users where is_admin)                              as admins,
        (select count(*) from users where plan = 'pro')                          as pro,
        (select count(*) from crews)                                             as crews,
        (select count(*) from check_ins where local_date = current_date)         as checkins_today,
        (select count(*) from users where created_at > now() - interval '7 days') as signups_7d,
        (select count(distinct user_id) from sessions
           where last_seen_at > now() - interval '7 days')                       as active_7d`,
  );
  const r = rows[0] ?? {};
  const n = (v: string | undefined) => Number(v ?? 0);
  return Response.json({
    users: n(r.users),
    admins: n(r.admins),
    pro: n(r.pro),
    crews: n(r.crews),
    checkinsToday: n(r.checkins_today),
    signups7d: n(r.signups_7d),
    active7d: n(r.active_7d),
  });
}
