import { currentUser } from '@/server/auth/session';
import { withUser } from '@/server/db';
import { localDateFor } from '@/server/streak';
import { resolveUserBearing } from '@/server/bearing/resolve';
import { getSchool, SCHOOLS } from '@/server/bearing/schools';
import type { BearingResponse, BearingView, SchoolView } from '@/lib/data/types';

// GET  /api/bearing → the school picker (all schools + followed flag) plus today's bearing for
//                     each followed school, resolved per user (built around a live struggle when
//                     there is one, else the shared date-rotated bearing) and cached for the day.
// POST /api/bearing { bearingId, note } → log a PRIVATE response (never shown to the crew).
//                     `bearingId` is the user_bearings row the reader is responding to.

export async function GET(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  const { tz, followed, recoveryAck } = await withUser(userId, async (c) => {
    const t = (await c.query(`select tz from users where id = current_app_user()`)).rows[0]?.tz ?? 'UTC';
    const rows = (await c.query(`select ideology from user_schools where user_id = current_app_user() order by sort, created_at`)).rows;
    const ack = (await c.query(
      `select recovery_terms_acknowledged_at is not null as ack from accountability_profiles where user_id = current_app_user()`,
    )).rows[0]?.ack ?? false;
    return { tz: t as string, followed: rows.map((r) => r.ideology as string), recoveryAck: ack as boolean };
  });

  const localDate = localDateFor(tz);
  const followedSet = new Set(followed);

  // Resolve each followed school's Bearing for this user (per-user when a struggle is live, else a
  // copy of the shared neutral bearing). SEQUENTIAL on purpose: the no-repeat check compares each
  // new read against the reader's already-stored reads, including the ones resolved earlier in this
  // same pass, so two schools never yield near-identical reads today (RECOVERY_EXPANSION.md).
  const bearings: NonNullable<Awaited<ReturnType<typeof resolveUserBearing>>>[] = [];
  for (const id of followed) {
    const b = await resolveUserBearing(userId, id, localDate).catch(() => null);
    if (b) bearings.push(b);
  }

  const loggedIds = await withUser(userId, async (c) => {
    const rows = (await c.query(
      `select distinct user_bearing_id from bearing_logs
        where user_id = current_app_user() and local_date = $1 and user_bearing_id is not null`,
      [localDate],
    )).rows;
    return new Set(rows.map((r) => r.user_bearing_id as string));
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
    family: s.family,
    label: s.label,
    blurb: s.blurb,
    followed: followedSet.has(s.ideology),
  }));

  const body: BearingResponse = { localDate, schools, today, recoveryAck };
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

  // The response points at the user's resolved bearing (RLS scopes the lookup to the owner).
  const meta = await withUser(userId, async (c) =>
    (
      await c.query(
        `select ideology, to_char(local_date, 'YYYY-MM-DD') as local_date
           from user_bearings where id = $1 and user_id = current_app_user()`,
        [bearingId],
      )
    ).rows[0] as { ideology: string; local_date: string } | undefined,
  );
  if (!meta) return Response.json({ error: 'unknown bearing' }, { status: 404 });

  await withUser(userId, async (c) => {
    await c.query(
      `insert into bearing_logs (user_id, user_bearing_id, ideology, local_date, note)
       values (current_app_user(), $1, $2, $3, $4)`,
      [bearingId, meta.ideology, meta.local_date, note],
    );
  });
  return Response.json({ ok: true, loggedToday: true });
}
