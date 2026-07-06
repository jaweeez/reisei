import { currentUser } from '@/server/auth/session';
import { withUser } from '@/server/db';
import { localDateFor } from '@/server/streak';

// GET  /api/lines            → the user's lines (active first, then retired)
// POST /api/lines { statement, kind? } → draw a line (one active line per user, P6)
// DELETE /api/lines?id=…     → retire a line

export async function GET(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  const lines = await withUser(userId, async (c) =>
    (await c.query(
      `select id, statement, kind, status,
              to_char(start_local_date,'YYYY-MM-DD') as "startLocalDate",
              to_char(retired_local_date,'YYYY-MM-DD') as "retiredLocalDate"
         from lines where user_id = current_app_user()
        order by (status = 'active') desc, created_at desc`,
    )).rows,
  );
  return Response.json({ lines });
}

export async function POST(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let b: { statement?: unknown; kind?: unknown };
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const statement = typeof b.statement === 'string' ? b.statement.trim() : '';
  const kind = b.kind === 'hold' ? 'hold' : 'abstain';
  if (statement.length < 2 || statement.length > 80) {
    return Response.json({ error: 'Your line must be 2–80 characters.' }, { status: 400 });
  }

  try {
    const line = await withUser(userId, async (c) => {
      const tz = (await c.query(`select tz from users where id = current_app_user()`)).rows[0]?.tz ?? 'UTC';
      const today = localDateFor(tz);
      return (await c.query(
        `insert into lines (user_id, statement, kind, start_local_date)
         values (current_app_user(), $1, $2, $3)
         returning id, statement, kind, to_char(start_local_date,'YYYY-MM-DD') as "startLocalDate"`,
        [statement, kind, today],
      )).rows[0];
    });
    return Response.json({ line });
  } catch (e) {
    // lines_one_active_per_user unique index → already holding a line.
    if ((e as { code?: string }).code === '23505') {
      return Response.json({ error: 'You already hold a line. Retire it before drawing a new one.' }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'Missing line id.' }, { status: 400 });

  const retired = await withUser(userId, async (c) => {
    const tz = (await c.query(`select tz from users where id = current_app_user()`)).rows[0]?.tz ?? 'UTC';
    return (await c.query(
      `update lines set status = 'retired', retired_local_date = $2
        where id = $1 and user_id = current_app_user() and status = 'active'
        returning id`,
      [id, localDateFor(tz)],
    )).rowCount;
  });
  if (!retired) return Response.json({ error: 'No active line with that id.' }, { status: 404 });
  return Response.json({ ok: true });
}
