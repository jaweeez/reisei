import { currentUser } from '@/server/auth/session';
import { mintOrgInvite, orgOwnedBy, revokeOrgInvite } from '@/server/org/store';

// POST   /api/org/invite { crewId? } → mint an org-wide code. Joiners are auto-seated;
//                                       crewId (an org Corner) lands them in that group.
// DELETE /api/org/invite { code }    → revoke a live code.
export async function POST(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  const org = await orgOwnedBy(userId);
  if (!org) return Response.json({ error: 'You do not run an organization.' }, { status: 404 });

  let b: { crewId?: unknown } = {};
  try {
    b = await req.json();
  } catch {
    /* crewId optional */
  }
  const crewId = typeof b.crewId === 'string' && b.crewId ? b.crewId : null;

  const code = await mintOrgInvite(org.id, userId, crewId);
  if (!code) return Response.json({ error: 'That Corner is not part of your organization.' }, { status: 400 });
  return Response.json({ code });
}

export async function DELETE(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  const org = await orgOwnedBy(userId);
  if (!org) return Response.json({ error: 'You do not run an organization.' }, { status: 404 });

  let b: { code?: unknown } = {};
  try {
    b = await req.json();
  } catch {
    /* validated below */
  }
  const code = typeof b.code === 'string' ? b.code.trim() : '';
  if (!code) return Response.json({ error: 'Missing code.' }, { status: 400 });

  const ok = await revokeOrgInvite(org.id, code);
  if (!ok) return Response.json({ error: 'No live code by that name.' }, { status: 404 });
  return Response.json({ ok: true });
}
