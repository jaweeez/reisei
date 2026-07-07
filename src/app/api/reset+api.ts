import { currentUser } from '@/server/auth/session';
import { withUser } from '@/server/db';
import { localDateFor } from '@/server/streak';

// POST /api/reset { note? } → log a completed Reset (box-breathing + grounding).
// Private composure practice; never surfaced to the crew.
export async function POST(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let b: { note?: unknown } = {};
  try {
    b = await req.json();
  } catch {
    /* body optional */
  }
  const note = typeof b.note === 'string' ? b.note.trim().slice(0, 140) || null : null;

  await withUser(userId, async (c) => {
    const tz = (await c.query(`select tz from users where id = current_app_user()`)).rows[0]?.tz ?? 'UTC';
    await c.query(
      `insert into practices (user_id, kind, local_date, note) values (current_app_user(), 'reset', $1, $2)`,
      [localDateFor(tz), note],
    );
  });
  return Response.json({ ok: true });
}
