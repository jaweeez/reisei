import { hashSecret, normalizeUsername, validateCredentials } from '@/server/auth/credential';
import { createSession, sessionCookie } from '@/server/auth/session';
import { adminPool, pool } from '@/server/db';

// POST /api/auth/register { username, pin, name? }
export async function POST(req: Request) {
  let b: { username?: unknown; pin?: unknown; name?: unknown };
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const username = normalizeUsername(typeof b.username === 'string' ? b.username : '');
  const pin = typeof b.pin === 'string' ? b.pin : '';
  const name = typeof b.name === 'string' ? b.name : '';

  const invalid = validateCredentials(username, pin);
  if (invalid) return Response.json({ error: invalid }, { status: 400 });

  const pinHash = await hashSecret(pin);
  const { rows } = await pool().query(`select auth_register_user($1, $2, $3) as id`, [username, name, pinHash]);
  const userId = rows[0]?.id as string | null;
  if (!userId) return Response.json({ error: 'That username is taken.' }, { status: 409 });

  const token = await createSession(userId, req.headers.get('user-agent'));
  const user = (await adminPool().query(`select id, name, username, tz, plan from users where id = $1`, [userId])).rows[0];
  return Response.json({ token, user }, { headers: { 'set-cookie': sessionCookie(token) } });
}
