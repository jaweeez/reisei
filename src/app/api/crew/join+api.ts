import { currentUser } from '@/server/auth/session';
import { adminPool, pool } from '@/server/db';
import { getEntitlement } from '@/server/entitlement';

// POST /api/crew/join { code } → join the Crew behind an invite code.
// A Crew runs on covered members. Three ways in:
//   • already premium (own Pro, a seat, org owner) → plain join (cap still applies).
//   • free → direct Pro covers up to two invited people.
//   • free → a Crew-plan seat can cover the join after direct Pro coverage is unavailable.
// Unknown code → 404 either way (the client then tries it as an organization code, which
// has no premium gate by design — org seats make their holders premium).
// The size cap (8) → 409: a fact, not a paywall.
export async function POST(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let b: { code?: unknown; honestyAccepted?: unknown };
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const code = typeof b.code === 'string' ? b.code.trim() : '';
  if (!code) return Response.json({ error: 'Enter an invite code.' }, { status: 400 });

  if (b.honestyAccepted === true) {
    await adminPool().query(
      `insert into accountability_profiles (user_id, honesty_acknowledged_at)
       values ($1, now())
       on conflict (user_id) do update set honesty_acknowledged_at = coalesce(accountability_profiles.honesty_acknowledged_at, now())`,
      [userId],
    );
  }
  const agreed = (
    await adminPool().query(
      `select 1 from accountability_profiles where user_id = $1 and honesty_acknowledged_at is not null`,
      [userId],
    )
  ).rowCount;
  if (!agreed) return Response.json({ error: 'Accept the honesty agreement before joining a Crew.' }, { status: 409 });

  const ent = await getEntitlement(userId);

  if (ent.premium) {
    if (ent.coveredByPro) {
      const memberships = (
        await adminPool().query(`select count(*)::int n from crew_members where user_id = $1`, [userId])
      ).rows[0]?.n as number | undefined;
      if (Number(memberships ?? 0) > 0) {
        return Response.json({ error: 'Your covered Pro access belongs to one Crew.' }, { status: 409 });
      }
    }
    try {
      const { rows } = await pool().query(`select crew_join($1, $2) as crew_id`, [userId, code]);
      const crewId = rows[0]?.crew_id as string | null;
      if (!crewId) return Response.json({ error: 'That invite code is invalid.' }, { status: 404 });
      return Response.json({ crewId });
    } catch (e) {
      if ((e as { code?: string }).code === 'RS001') {
        return Response.json({ error: 'That Crew is full.' }, { status: 409 });
      }
      throw e;
    }
  }

  // Free caller: first use one of the captain's two direct-Pro covered spots.
  const covered = await pool().query(`select * from crew_join_pro_covered($1, $2)`, [userId, code]);
  const cover = covered.rows[0] as { crew_id: string; covered: boolean; note: string } | undefined;
  if (cover && !cover.note) return Response.json({ crewId: cover.crew_id, covered: cover.covered });
  if (cover?.note === 'crew_full') return Response.json({ error: 'That Crew is full.' }, { status: 409 });

  // Then try the captain's flat Crew-plan seat pool.
  const { rows } = await pool().query(`select * from corner_join_seated($1, $2)`, [userId, code]);
  const r = rows[0] as { crew_id: string; seated: boolean; note: string } | undefined;
  if (!r) return Response.json({ error: 'That invite code is invalid.' }, { status: 404 });
  if (r.note === 'no_seat') {
    return Response.json(
      { error: 'That Crew has no covered spots open. Go Pro, or ask the captain to add coverage.', upsell: true },
      { status: 402 },
    );
  }
  if (r.note === 'corner_full') {
    return Response.json({ error: 'That Crew is full.' }, { status: 409 });
  }
  return Response.json({ crewId: r.crew_id, seated: r.seated });
}
