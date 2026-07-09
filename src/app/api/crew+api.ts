import { currentUser } from '@/server/auth/session';
import { pool } from '@/server/db';
import { getEntitlement } from '@/server/entitlement';
import { orgOwnedBy } from '@/server/org/store';

// POST /api/crew { name } → create & captain a crew. Gated on any paid tier ("pay to
// lead"). An org owner's new Corners are auto-tagged into their org, so the dashboard
// sees every group they run.
export async function POST(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  const ent = await getEntitlement(userId);
  if (!ent.canCreateCrew) {
    return Response.json(
      { error: 'Creating a Corner is a Pro feature. Upgrade to lead.', upsell: true },
      { status: 402 },
    );
  }

  let b: { name?: unknown };
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const name = typeof b.name === 'string' ? b.name.trim().slice(0, 60) : '';
  if (name.length < 2) return Response.json({ error: 'Give your Corner a name.' }, { status: 400 });

  const org = ent.tier === 'org' ? await orgOwnedBy(userId) : null;
  const { rows } = await pool().query(`select crew_create($1, $2, $3) as id`, [userId, name, org?.id ?? null]);
  return Response.json({ id: rows[0]?.id as string });
}
