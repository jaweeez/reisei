import { currentUser } from '@/server/auth/session';
import { withUser } from '@/server/db';
import { getEntitlement } from '@/server/entitlement';
import { IDEOLOGY_LABEL } from '@/data/corpus/types';
import type { BearingHistory, BearingLogItem } from '@/lib/data/types';

// GET /api/bearing/history → the user's private log archive (each response paired with the
// bearing it answered). Free = last 30 days (matches the free history tier); Pro = all.
// `upsell` flags that older entries exist beyond the free window.

export async function GET(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  const ent = await getEntitlement(userId);

  const data = await withUser<BearingHistory>(userId, async (c) => {
    const windowed = !ent.premium;
    const logs = (
      await c.query(
        `select to_char(bl.local_date, 'YYYY-MM-DD') as date, bl.ideology, bl.note, b.principle
           from bearing_logs bl
           left join bearings b on b.id = bl.bearing_id
          where bl.user_id = current_app_user()
            ${windowed ? `and bl.local_date >= current_date - interval '30 days'` : ''}
          order by bl.created_at desc
          limit 300`,
      )
    ).rows;

    let upsell = false;
    if (windowed) {
      const older = (
        await c.query(
          `select 1 from bearing_logs where user_id = current_app_user() and local_date < current_date - interval '30 days' limit 1`,
        )
      ).rowCount;
      upsell = (older ?? 0) > 0;
    }

    const items: BearingLogItem[] = logs.map((r) => {
      const ideology = r.ideology as string;
      return {
        date: r.date as string,
        ideology,
        label: IDEOLOGY_LABEL[ideology as keyof typeof IDEOLOGY_LABEL] ?? ideology,
        principle: (r.principle as string) ?? '',
        note: r.note as string,
      };
    });
    return { logs: items, upsell };
  });

  return Response.json(data);
}
