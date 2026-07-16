import { currentUser } from '@/server/auth/session';
import { withUser } from '@/server/db';
import { localDateFor } from '@/server/streak';
import { daysSince, isMilestoneDay, milestoneReached } from '@/server/recovery/mode';
import type { PoolClient } from 'pg';

// Opt-in Recovery mode (docs/RECOVERY_EXPANSION.md). Owner-private, never in the Crew graph.
// Separate route from /api/recovery (the honest-break recovery_plan endpoint).
// GET  /api/recovery-mode → the snapshot (enabled, mode, sober-day count + milestone, chapters).
// POST /api/recovery-mode { op } → setup | preferences | begin_again | disable.
// The daily action stays the app's held/slipped Line check-in; this only adds the sober-time layer.

const MODES = new Set(['chapter', 'practice']);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A start date must be a real day, not in the future, and not absurdly old. */
function validStart(value: unknown, today: string): value is string {
  if (typeof value !== 'string' || !DATE.test(value) || value < '1950-01-01' || value > today) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

async function readTodayLocal(c: PoolClient): Promise<string> {
  const tz = (await c.query(`select tz from users where id = current_app_user()`)).rows[0]?.tz ?? 'UTC';
  return localDateFor(tz as string);
}

async function snapshot(c: PoolClient) {
  const today = await readTodayLocal(c);
  const p = (
    await c.query(
      `select mode, started_on::text as "startedOn", show_count as "showCount",
              what_from as "whatFrom", has_sponsor as "hasSponsor",
              sponsor_name as "sponsorName", sponsor_contact as "sponsorContact"
         from recovery_profiles where user_id = current_app_user()`,
    )
  ).rows[0] as
    | {
        mode: string;
        startedOn: string | null;
        showCount: boolean;
        whatFrom: string | null;
        hasSponsor: boolean;
        sponsorName: string | null;
        sponsorContact: string | null;
      }
    | undefined;

  const chapters = (
    await c.query(
      `select started_on::text as "startedOn", ended_on::text as "endedOn"
         from recovery_chapters where user_id = current_app_user() order by started_on desc`,
    )
  ).rows;

  if (!p) return { enabled: false, today, chapters };

  const days = p.mode === 'chapter' && p.startedOn ? daysSince(p.startedOn, today) : null;
  const milestone = days != null ? milestoneReached(days) : null;
  return {
    enabled: true,
    today,
    mode: p.mode,
    startedOn: p.startedOn,
    showCount: p.showCount,
    whatFrom: p.whatFrom,
    hasSponsor: p.hasSponsor,
    sponsorName: p.sponsorName,
    sponsorContact: p.sponsorContact,
    days,
    milestone: milestone?.label ?? null,
    isMilestoneToday: days != null && isMilestoneDay(days),
    chapters,
  };
}

/** Enabling Recovery mode records the not-treatment acknowledgment (whichever comes first). */
async function recordAck(c: PoolClient): Promise<void> {
  await c.query(
    `insert into accountability_profiles (user_id, recovery_terms_acknowledged_at, updated_at)
     values (current_app_user(), now(), now())
     on conflict (user_id) do update set
       recovery_terms_acknowledged_at = coalesce(accountability_profiles.recovery_terms_acknowledged_at, now()),
       updated_at = now()`,
  );
}

export async function GET(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });
  return withUser(userId, async (c) => Response.json(await snapshot(c)));
}

export async function POST(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  return withUser(userId, async (c) => {
    const today = await readTodayLocal(c);

    if (b.op === 'setup') {
      const mode = MODES.has(b.mode as string) ? (b.mode as string) : null;
      if (!mode) return Response.json({ error: 'Choose chapter or practice.' }, { status: 400 });
      const startedOn = mode === 'chapter' ? b.startedOn : null;
      if (mode === 'chapter' && !validStart(startedOn, today)) {
        return Response.json({ error: 'Choose a real start date, today or earlier.' }, { status: 400 });
      }
      const whatFrom = typeof b.whatFrom === 'string' ? b.whatFrom.trim().slice(0, 120) || null : null;
      const hasSponsor = b.hasSponsor === true;

      const created = await c.query(
        `insert into recovery_profiles (user_id, mode, started_on, what_from, has_sponsor)
         values (current_app_user(), $1, $2::date, $3, $4)
         on conflict (user_id) do nothing
         returning user_id`,
        [mode, mode === 'chapter' ? startedOn : null, whatFrom, hasSponsor],
      );
      if (created.rowCount && mode === 'chapter') {
        await c.query(
          `insert into recovery_chapters (user_id, started_on)
           select current_app_user(), $1::date
           where not exists (select 1 from recovery_chapters where user_id = current_app_user() and ended_on is null)`,
          [startedOn],
        );
      }
      await recordAck(c);
      return Response.json(await snapshot(c));
    }

    if (b.op === 'preferences') {
      const sets: string[] = [];
      const args: unknown[] = [];
      if (typeof b.showCount === 'boolean') { args.push(b.showCount); sets.push(`show_count = $${args.length}`); }
      if (typeof b.hasSponsor === 'boolean') { args.push(b.hasSponsor); sets.push(`has_sponsor = $${args.length}`); }
      if (typeof b.whatFrom === 'string') { args.push(b.whatFrom.trim().slice(0, 120) || null); sets.push(`what_from = $${args.length}`); }
      if (typeof b.sponsorName === 'string') { args.push(b.sponsorName.trim().slice(0, 80) || null); sets.push(`sponsor_name = $${args.length}`); }
      if (typeof b.sponsorContact === 'string') { args.push(b.sponsorContact.trim().slice(0, 120) || null); sets.push(`sponsor_contact = $${args.length}`); }
      if (!sets.length) return Response.json({ error: 'Nothing to update.' }, { status: 400 });
      const updated = await c.query(
        `update recovery_profiles set ${sets.join(', ')}, updated_at = now() where user_id = current_app_user() returning user_id`,
        args,
      );
      if (!updated.rowCount) return Response.json({ error: 'Set up Recovery mode first.' }, { status: 409 });
      return Response.json(await snapshot(c));
    }

    if (b.op === 'begin_again') {
      const prof = (await c.query(`select mode from recovery_profiles where user_id = current_app_user()`)).rows[0] as
        | { mode: string }
        | undefined;
      if (!prof) return Response.json({ error: 'Set up Recovery mode first.' }, { status: 409 });
      if (prof.mode !== 'chapter') return Response.json({ error: 'Begin again applies to a counted chapter.' }, { status: 400 });
      // Close the running chapter (as of yesterday) and open a new one starting today. No shame
      // reset: prior chapters stay. Then move the profile's start date to today.
      await c.query(
        `update recovery_chapters set ended_on = ($1::date - 1)
          where user_id = current_app_user() and ended_on is null and started_on < $1::date`,
        [today],
      );
      await c.query(
        `insert into recovery_chapters (user_id, started_on)
         select current_app_user(), $1::date
         where not exists (select 1 from recovery_chapters where user_id = current_app_user() and ended_on is null)`,
        [today],
      );
      await c.query(
        `update recovery_profiles set started_on = $1::date, updated_at = now()
          where user_id = current_app_user() and mode = 'chapter'`,
        [today],
      );
      return Response.json(await snapshot(c));
    }

    if (b.op === 'disable') {
      // Turn the mode off and close any running chapter today. History stays, but no stale active
      // chapter can block a later re-enable with a new start date.
      await c.query(
        `update recovery_chapters set ended_on = greatest(started_on, $1::date)
          where user_id = current_app_user() and ended_on is null`,
        [today],
      );
      await c.query(`delete from recovery_profiles where user_id = current_app_user()`);
      return Response.json(await snapshot(c));
    }

    return Response.json({ error: 'Unknown recovery operation.' }, { status: 400 });
  });
}
