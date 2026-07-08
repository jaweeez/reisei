import { currentUser } from '@/server/auth/session';
import { adminPool, withUser } from '@/server/db';
import { localDateFor } from '@/server/streak';
import { getOrCreateBearing } from '@/server/bearing/store';
import { getSchool, SCHOOLS } from '@/server/bearing/schools';
import type { BearingResponse, BearingView, SchoolView } from '@/lib/data/types';

// GET  /api/bearing → the school picker (all schools + followed flag) plus today's bearing
//                     for each followed school (generated + cached on first request).
// POST /api/bearing { bearingId, note } → log a PRIVATE response (never shown to the crew).

export async function GET(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  const { tz, followed } = await withUser(userId, async (c) => {
    const t = (await c.query(`select tz from users where id = current_app_user()`)).rows[0]?.tz ?? 'UTC';
    const rows = (await c.query(`select ideology from user_schools where user_id = current_app_user() order by sort, created_at`)).rows;
    return { tz: t as string, followed: rows.map((r) => r.ideology as string) };
  });

  const localDate = localDateFor(tz);
  const followedSet = new Set(followed);

  // One shared row per (school, day) — generated on first request, cached thereafter.
  const stored = await Promise.all(followed.map((id) => getOrCreateBearing(id, localDate).catch(() => null)));
  const bearings = stored.filter((b): b is NonNullable<typeof b> => b !== null);

  const loggedIds = await withUser(userId, async (c) => {
    const rows = (await c.query(
      `select distinct bearing_id from bearing_logs
        where user_id = current_app_user() and local_date = $1 and bearing_id is not null`,
      [localDate],
    )).rows;
    return new Set(rows.map((r) => r.bearing_id as string));
  });

  const today: BearingView[] = bearings.map((b) => {
    const school = getSchool(b.ideology)!;
    return {
      bearingId: b.id,
      ideology: b.ideology,
      label: school.label,
      principle: b.principle,
      prompt: b.prompt,
      quote: b.quote,
      source: b.source,
      copyright: school.copyright,
      loggedToday: loggedIds.has(b.id),
    };
  });

  const schools: SchoolView[] = SCHOOLS.map((s) => ({
    ideology: s.ideology,
    label: s.label,
    blurb: s.blurb,
    followed: followedSet.has(s.ideology),
  }));

  const body: BearingResponse = { localDate, schools, today };
  return Response.json(body);
}

export async function POST(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let b: { bearingId?: unknown; note?: unknown } = {};
  try {
    b = await req.json();
  } catch {
    /* body required below */
  }
  const bearingId = typeof b.bearingId === 'string' ? b.bearingId : null;
  const note = typeof b.note === 'string' ? b.note.trim().slice(0, 400) : '';
  if (!bearingId) return Response.json({ error: 'bearingId required' }, { status: 400 });
  if (!note) return Response.json({ error: 'Write something to log.' }, { status: 400 });

  // The bearing's school + date (owner role — `bearings` has no RLS).
  const meta = (
    await adminPool().query(`select ideology, to_char(local_date, 'YYYY-MM-DD') as local_date from bearings where id = $1`, [bearingId])
  ).rows[0] as { ideology: string; local_date: string } | undefined;
  if (!meta) return Response.json({ error: 'unknown bearing' }, { status: 404 });

  await withUser(userId, async (c) => {
    await c.query(
      `insert into bearing_logs (user_id, bearing_id, ideology, local_date, note)
       values (current_app_user(), $1, $2, $3, $4)`,
      [bearingId, meta.ideology, meta.local_date, note],
    );
  });
  return Response.json({ ok: true, loggedToday: true });
}
