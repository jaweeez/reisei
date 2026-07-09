import { currentUser } from '@/server/auth/session';
import { pool } from '@/server/db';
import { getEntitlement } from '@/server/entitlement';

// POST /api/crew/join { code } → join the Corner behind an invite code.
// A Corner runs on paid seats. Two ways in:
//   • already premium (own Pro, a seat, org owner) → plain join (cap still applies).
//   • free → corner_join_seated consumes a free seat from the captain's pool atomically;
//     the seat IS the premium. No pool / pool exhausted → 402 upsell.
// Unknown code → 404 either way (the client then tries it as an organization code, which
// has no premium gate by design — org seats make their holders premium).
// The size cap (8) → 409: a fact, not a paywall.
export async function POST(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let b: { code?: unknown };
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const code = typeof b.code === 'string' ? b.code.trim() : '';
  if (!code) return Response.json({ error: 'Enter an invite code.' }, { status: 400 });

  const ent = await getEntitlement(userId);

  if (ent.premium) {
    try {
      const { rows } = await pool().query(`select crew_join($1, $2) as crew_id`, [userId, code]);
      const crewId = rows[0]?.crew_id as string | null;
      if (!crewId) return Response.json({ error: 'That invite code is invalid.' }, { status: 404 });
      return Response.json({ crewId });
    } catch (e) {
      if ((e as { code?: string }).code === 'RS001') {
        return Response.json({ error: 'That Corner is full.' }, { status: 409 });
      }
      throw e;
    }
  }

  // Free caller: the captain's seat pool funds the join.
  const { rows } = await pool().query(`select * from corner_join_seated($1, $2)`, [userId, code]);
  const r = rows[0] as { crew_id: string; seated: boolean; note: string } | undefined;
  if (!r) return Response.json({ error: 'That invite code is invalid.' }, { status: 404 });
  if (r.note === 'no_seat') {
    return Response.json(
      { error: 'A Corner runs on paid seats. Go Pro, or ask your captain for a seat.', upsell: true },
      { status: 402 },
    );
  }
  if (r.note === 'corner_full') {
    return Response.json({ error: 'That Corner is full.' }, { status: 409 });
  }
  return Response.json({ crewId: r.crew_id, seated: r.seated });
}
