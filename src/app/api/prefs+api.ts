import { currentUser } from '@/server/auth/session';
import { withUser } from '@/server/db';

// POST /api/prefs { holdTime } → set the local HH:MM the coach's "post" nudge fires.
// The one user-tunable knob; nudge CONTENT is never user-tunable.
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function POST(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let b: { holdTime?: unknown };
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const holdTime = typeof b.holdTime === 'string' ? b.holdTime : '';
  if (!HHMM.test(holdTime)) return Response.json({ error: 'holdTime must be HH:MM (24h).' }, { status: 400 });

  await withUser(userId, (c) => c.query(`update users set hold_time = $1 where id = current_app_user()`, [holdTime]));
  return Response.json({ ok: true, holdTime });
}
