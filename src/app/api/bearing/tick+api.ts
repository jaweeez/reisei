import { adminPool } from '@/server/db';
import { localDateFor } from '@/server/streak';
import { getOrCreateBearing } from '@/server/bearing/store';
import { refreshNextDueSourceLocked } from '@/server/sourceRefresh';

// GET /api/bearing/tick — pre-warm today's bearing for every (school, timezone) a user
// follows, so first-open is instant. On-demand generation already guarantees correctness;
// this is purely latency. Secured by CRON_SECRET (Vercel cron sends Authorization: Bearer).

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: 'CRON_SECRET not configured.' }, { status: 503 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const combos = (
    await adminPool().query(
      `select distinct us.ideology, coalesce(u.tz, 'UTC') as tz
         from user_schools us join users u on u.id = us.user_id`,
    )
  ).rows as { ideology: string; tz: string }[];

  let warmed = 0;
  for (const combo of combos) {
    try {
      await getOrCreateBearing(combo.ideology, localDateFor(combo.tz));
      warmed += 1;
    } catch (e) {
      console.error('bearing tick error', combo.ideology, e instanceof Error ? e.message : e);
    }
  }
  // Keep the corpus schedule on this existing daily cron. That preserves the two-job limit on
  // Vercel's Hobby plan while refreshing exactly one school-balanced source each day.
  let sourceRefresh: Awaited<ReturnType<typeof refreshNextDueSourceLocked>> | null = null;
  try {
    sourceRefresh = await refreshNextDueSourceLocked(adminPool());
  } catch (error) {
    console.error('bearing source refresh error', error instanceof Error ? error.message : error);
  }

  return Response.json({ combos: combos.length, warmed, sourceRefresh });
}
