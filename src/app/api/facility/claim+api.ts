import { currentUser } from '@/server/auth/session';
import { adminPool } from '@/server/db';

// POST /api/facility/claim { code } → claim a facility-sponsored seat, anonymously.
// The seat grants full private Pro (a seat_assignment ⇒ `team` tier). The facility never learns who
// claimed it. Idempotent: re-entering a code you already claimed is a no-op success.

const NOTE: Record<string, { status: number; error: string }> = {
  invalid_code: { status: 404, error: 'That code is not valid or has been turned off.' },
  inactive: { status: 409, error: 'This facility has no active seats right now. Ask them to add seats.' },
  seat_full: { status: 409, error: 'All of this facility’s seats are claimed. Ask them to add more.' },
};

export async function POST(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let b: { code?: unknown } = {};
  try {
    b = await req.json();
  } catch {
    /* validated below */
  }
  const code = typeof b.code === 'string' ? b.code.trim() : '';
  if (!code) return Response.json({ error: 'Enter your facility code.' }, { status: 400 });

  const row = (await adminPool().query(`select claimed, note from facility_claim($1, $2)`, [userId, code])).rows[0] as
    | { claimed: boolean; note: string }
    | undefined;

  if (!row?.claimed) {
    const m = NOTE[row?.note ?? 'invalid_code'] ?? { status: 400, error: 'Could not claim a seat.' };
    return Response.json({ error: m.error }, { status: m.status });
  }
  return Response.json({ ok: true });
}
