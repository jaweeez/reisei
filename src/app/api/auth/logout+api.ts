import { clearedCookie, revokeSession, tokenFromRequest } from '@/server/auth/session';

// POST /api/auth/logout — revoke the session (server-side) and clear the web cookie.
export async function POST(req: Request) {
  await revokeSession(tokenFromRequest(req));
  return Response.json({ ok: true }, { headers: { 'set-cookie': clearedCookie() } });
}
