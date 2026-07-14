import { adminPool } from '@/server/db';
import { refreshNextDueSourceLocked } from '@/server/sourceRefresh';

// GET /api/corpus/refresh — protected daily cron. It refreshes one due, approved source at a
// time; source state makes each entry due again after 89 days.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: 'CRON_SECRET not configured.' }, { status: 503 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ error: 'unauthorized' }, { status: 401 });

  try {
    return Response.json(await refreshNextDueSourceLocked(adminPool()));
  } catch (error) {
    console.error('corpus refresh error:', error instanceof Error ? error.message : error);
    return Response.json({ error: 'Source refresh failed.' }, { status: 500 });
  }
}
