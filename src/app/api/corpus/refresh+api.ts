import { adminPool } from '@/server/db';
import { refreshNextDueSource } from '@/server/sourceRefresh';

// GET /api/corpus/refresh — protected daily cron. It refreshes one due, approved source at a
// time; source state makes each entry due again after 89 days.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: 'CRON_SECRET not configured.' }, { status: 503 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const client = await adminPool().connect();
  let locked = false;
  try {
    const lock = (await client.query(`select pg_try_advisory_lock(8920147) as locked`)).rows[0] as { locked?: boolean } | undefined;
    locked = !!lock?.locked;
    if (!locked) return Response.json({ skipped: 'refresh already running' });
    return Response.json(await refreshNextDueSource(client));
  } catch (error) {
    console.error('corpus refresh error:', error instanceof Error ? error.message : error);
    return Response.json({ error: 'Source refresh failed.' }, { status: 500 });
  } finally {
    if (locked) await client.query(`select pg_advisory_unlock(8920147)`).catch(() => undefined);
    client.release();
  }
}
