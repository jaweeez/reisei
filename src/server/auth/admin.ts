import { adminPool } from '../db';
import { currentUser } from './session';

// Guard for the /api/admin/* routes. Admin endpoints run as the OWNER role
// (adminPool, BYPASSRLS) so they can read/moderate across every user and crew — this
// guard is the only thing standing between a normal session and that power, so every
// admin route MUST call it first and 403 on null.

/** Resolve a request to an ADMIN user id, or null (no session, or not an admin). */
export async function adminUserId(req: Request): Promise<string | null> {
  const userId = await currentUser(req);
  if (!userId) return null;
  const { rows } = await adminPool().query<{ is_admin: boolean }>(
    `select is_admin from users where id = $1`,
    [userId],
  );
  return rows[0]?.is_admin ? userId : null;
}

/** Standard 403 for a non-admin (kept vague on purpose — don't reveal the route exists). */
export function forbidden(): Response {
  return Response.json({ error: 'forbidden' }, { status: 403 });
}
