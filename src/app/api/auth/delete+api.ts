import { clearedCookie, currentUser } from '@/server/auth/session';
import { verifySecret } from '@/server/auth/credential';
import { adminPool } from '@/server/db';

// POST /api/auth/delete { pin } — permanently delete the signed-in account and ALL its data.
// Required by the app stores (Apple Guideline 5.1.1(v), Google Play). PIN-confirmed so a
// hijacked session can't wipe an account. Runs as the owner role: captained crews are deleted
// first (crews.captain_id is ON DELETE RESTRICT — the one FK that won't cascade), then the user
// row, which cascades everything else (sessions, lines, check-ins, streaks, crew memberships,
// journal, profile, bearings, practices, device tokens, codes, subscriptions...).
export async function POST(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let b: { pin?: unknown } = {};
  try {
    b = await req.json();
  } catch {
    /* validated below */
  }
  const pin = typeof b.pin === 'string' ? b.pin : '';
  if (!pin) return Response.json({ error: 'Enter your PIN to confirm.' }, { status: 400 });

  const pool = adminPool();
  const row = (await pool.query(`select pin_hash from users where id = $1`, [userId])).rows[0] as
    | { pin_hash: string }
    | undefined;
  if (!row || !(await verifySecret(pin, row.pin_hash))) {
    return Response.json({ error: 'Wrong PIN.' }, { status: 403 });
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`delete from crews where captain_id = $1`, [userId]); // RESTRICT — must go first
    await client.query(`delete from users where id = $1`, [userId]); // cascades the rest
    await client.query('commit');
  } catch (e) {
    try {
      await client.query('rollback');
    } catch {
      /* ignore */
    }
    console.error('account delete error:', e instanceof Error ? e.message : e);
    return Response.json({ error: 'Could not delete the account. Try again.' }, { status: 500 });
  } finally {
    client.release();
  }

  return Response.json({ ok: true }, { headers: { 'set-cookie': clearedCookie() } });
}
