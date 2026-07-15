import { currentUser } from '@/server/auth/session';
import { adminPool, pool } from '@/server/db';
import { getEntitlement } from '@/server/entitlement';
import { orgOwnedBy } from '@/server/org/store';

// POST /api/crew { name } → create & captain a crew. Gated on any paid tier ("pay to
// lead"). An org owner's new Corners are auto-tagged into their org, so the dashboard
// sees every group they run.
export async function POST(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let b: { name?: unknown; honestyAccepted?: unknown };
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

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
  if (!agreed) return Response.json({ error: 'Accept the honesty agreement before starting a Crew.' }, { status: 409 });

  const ent = await getEntitlement(userId);
  if (!ent.canCreateCrew) {
    return Response.json(
      { error: ent.coveredByPro ? 'Your access belongs to this Crew. A direct Pro plan is required to start another.' : 'Creating a Crew is a Pro feature. Upgrade to lead.', upsell: !ent.coveredByPro },
      { status: 402 },
    );
  }
  if (ent.tier === 'pro' && ent.isCaptain) {
    return Response.json({ error: 'Pro includes one Crew. Manage the Crew you already lead.' }, { status: 409 });
  }
  const name = typeof b.name === 'string' ? b.name.trim().slice(0, 60) : '';
  if (name.length < 2) return Response.json({ error: 'Give your Crew a name.' }, { status: 400 });

  const org = ent.tier === 'org' ? await orgOwnedBy(userId) : null;
  const { rows } = await pool().query(`select crew_create($1, $2, $3) as id`, [userId, name, org?.id ?? null]);
  return Response.json({ id: rows[0]?.id as string });
}
