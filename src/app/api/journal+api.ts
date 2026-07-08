import { currentUser } from '@/server/auth/session';
import { getEntitlement } from '@/server/entitlement';
import { insertEntry, listEntries } from '@/server/journal/store';
import { ingestEntry } from '@/server/profile/profile';
import type { JournalLogged } from '@/lib/data/types';

// GET  /api/journal → the user's private log feed (free = last 30 days + upsell; Pro = all).
// POST /api/journal { body } → append a private entry. On write we kick off embedding +
// profile update + a crisis screen (best-effort, never blocks the write); `offramp` is true
// when the entry read like a genuinely hard place, so the log shows a real resource instead.

const MAX_BODY = 2000;

export async function GET(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  const ent = await getEntitlement(userId);
  const feed = await listEntries(userId, ent.premium);
  return Response.json(feed);
}

export async function POST(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let b: { body?: unknown } = {};
  try {
    b = await req.json();
  } catch {
    /* validated below */
  }
  const body = typeof b.body === 'string' ? b.body.trim().slice(0, MAX_BODY) : '';
  if (!body) return Response.json({ error: 'Write something to log.' }, { status: 400 });

  const entry = await insertEntry(userId, body);

  // Embed + fold into the profile + screen for crisis. Best-effort: a Voyage/model hiccup
  // must never lose the entry (it's already saved). `offramp` steers the client to a resource.
  let offramp = false;
  try {
    const res = await ingestEntry(userId, entry.id, body);
    offramp = res.offramp;
  } catch (e) {
    console.error('journal ingest error:', e instanceof Error ? e.message : e);
  }

  const out: JournalLogged = { entry, offramp };
  return Response.json(out);
}
