import { currentUser } from '@/server/auth/session';
import { withUser } from '@/server/db';
import { getEntitlement } from '@/server/entitlement';
import { isSchoolId, SCHOOLS } from '@/server/bearing/schools';
import type { SchoolView } from '@/lib/data/types';

// GET /api/bearing/schools → all schools + which the user follows.
// PUT /api/bearing/schools { ideologies } → replace the followed set. Free follows up to
// FREE_SCHOOL_LIMIT; more requires Pro (402 + upsell, the Ledger/crew convention).

const FREE_SCHOOL_LIMIT = 2;

async function followedSet(userId: string): Promise<Set<string>> {
  return withUser(userId, async (c) => {
    const rows = (await c.query(`select ideology from user_schools where user_id = current_app_user()`)).rows;
    return new Set(rows.map((r) => r.ideology as string));
  });
}

function view(followed: Set<string>): SchoolView[] {
  return SCHOOLS.map((s) => ({ ideology: s.ideology, family: s.family, label: s.label, blurb: s.blurb, followed: followed.has(s.ideology) }));
}

export async function GET(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });
  return Response.json({ schools: view(await followedSet(userId)) });
}

export async function PUT(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let b: { ideologies?: unknown } = {};
  try {
    b = await req.json();
  } catch {
    /* validated below */
  }
  const raw = Array.isArray(b.ideologies) ? b.ideologies : [];
  const ideologies = Array.from(new Set(raw.filter(isSchoolId))) as string[];

  const ent = await getEntitlement(userId);
  if (!ent.premium && ideologies.length > FREE_SCHOOL_LIMIT) {
    return Response.json(
      { error: `Free follows up to ${FREE_SCHOOL_LIMIT} schools. Go Pro to follow more.`, upsell: true },
      { status: 402 },
    );
  }

  await withUser(userId, async (c) => {
    await c.query(`delete from user_schools where user_id = current_app_user() and ideology <> all($1::text[])`, [ideologies]);
    for (let i = 0; i < ideologies.length; i += 1) {
      await c.query(
        `insert into user_schools (user_id, ideology, sort) values (current_app_user(), $1, $2)
         on conflict (user_id, ideology) do update set sort = excluded.sort`,
        [ideologies[i], i],
      );
    }
  });

  return Response.json({ schools: view(new Set(ideologies)) });
}
