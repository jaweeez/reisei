import { currentUser } from '@/server/auth/session';
import { withUser } from '@/server/db';

// POST /api/push/register { token, platform } → upsert this device's Expo push token.
// DELETE /api/push/register?token=… → drop it (on logout).
export async function POST(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let b: { token?: unknown; platform?: unknown };
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const token = typeof b.token === 'string' ? b.token : '';
  const platform = typeof b.platform === 'string' ? b.platform : null;
  if (!token) return Response.json({ error: 'Missing token.' }, { status: 400 });

  await withUser(userId, (c) =>
    c.query(
      `insert into device_tokens (user_id, token, platform) values (current_app_user(), $1, $2)
       on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now()`,
      [token, platform],
    ),
  );
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });
  const token = new URL(req.url).searchParams.get('token');
  if (!token) return Response.json({ error: 'Missing token.' }, { status: 400 });
  await withUser(userId, (c) => c.query(`delete from device_tokens where token = $1 and user_id = current_app_user()`, [token]));
  return Response.json({ ok: true });
}
