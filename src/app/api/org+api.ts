import { currentUser } from '@/server/auth/session';
import { createOrg, orgOverview, orgOwnedBy, renameOrg } from '@/server/org/store';

// GET   /api/org          → the caller's org dashboard (owner view), or { org: null }.
// POST  /api/org { name } → create an org (one per owner; created BEFORE checkout so the
//                           Stripe session can carry orgId in metadata).
// PATCH /api/org { name } → rename.
export async function GET(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  const org = await orgOwnedBy(userId);
  if (!org) return Response.json({ org: null });
  return Response.json({ org: await orgOverview(org.id) });
}

export async function POST(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let b: { name?: unknown };
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const name = typeof b.name === 'string' ? b.name.trim().slice(0, 60) : '';
  if (name.length < 2) return Response.json({ error: 'Give your organization a name.' }, { status: 400 });

  const org = await createOrg(userId, name);
  if (!org) return Response.json({ error: 'You already run an organization.' }, { status: 409 });
  return Response.json({ id: org.id, name: org.name });
}

export async function PATCH(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let b: { name?: unknown };
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const name = typeof b.name === 'string' ? b.name.trim().slice(0, 60) : '';
  if (name.length < 2) return Response.json({ error: 'Give your organization a name.' }, { status: 400 });

  const org = await orgOwnedBy(userId);
  if (!org) return Response.json({ error: 'You do not run an organization.' }, { status: 404 });
  await renameOrg(org.id, name);
  return Response.json({ ok: true });
}
