/* eslint-disable import/first -- dotenv must load env before importing modules that read it */
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { randomUUID } from 'node:crypto';
import { directPool, pool, withUser } from '../src/server/db';
import { toVectorLiteral } from '../src/server/ai/voyage';
import { daysSince } from '../src/server/recovery/mode';

// Integration harness for the DB-path features added in the recovery expansion (Phases 3 + 4):
//   • recovery-mode chapter state machine (setup / begin_again / preferences / disable)
//   • user_bearings.principle_vec round-trip + the no-repeat recent-window query
//   • RLS isolation between users (owner FORCE RLS + the reisei_app NOBYPASSRLS role)
// Runs the SAME SQL the API/resolver run, as the restricted app role, against a live Postgres.
// Creates throwaway users and deletes them (cascade) in a finally, so it is self-cleaning.
// Requires APP_DATABASE_URL + DIRECT_DATABASE_URL (a provisioned DB). Never point at production data.

const owner = directPool();
let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  console.log(`${cond ? '✓' : '✗'} ${name}${cond ? '' : `  — got: ${JSON.stringify(detail)}`}`);
  if (!cond) failures += 1;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (base: string, n: number) => iso(new Date(Date.parse(`${base}T00:00:00Z`) + n * 86_400_000));

async function makeUser(tag: string): Promise<string> {
  const id = randomUUID();
  await owner.query(
    `insert into users (id, name, username, pin_hash, tz) values ($1, $2, $3, 'x', 'UTC')`,
    [id, `IT ${tag}`, `it_${tag}_${id.slice(0, 8)}`],
  );
  return id;
}

// The exact statements the recovery-mode API runs, as the app role.
async function setup(userId: string, startedOn: string) {
  return withUser(userId, async (c) => {
    await c.query(
      `insert into recovery_profiles (user_id, mode, started_on, what_from, has_sponsor)
       values (current_app_user(), 'chapter', $1::date, $2, $3)
       on conflict (user_id) do nothing`,
      [startedOn, 'testing', false],
    );
    await c.query(
      `insert into recovery_chapters (user_id, started_on)
       select current_app_user(), $1::date
       where not exists (select 1 from recovery_chapters where user_id = current_app_user() and ended_on is null)`,
      [startedOn],
    );
  });
}

async function beginAgain(userId: string, today: string) {
  return withUser(userId, async (c) => {
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
  });
}

async function snapshot(userId: string) {
  return withUser(userId, async (c) => {
    const profile = (
      await c.query(
        `select mode, started_on::text as "startedOn", show_count as "showCount" from recovery_profiles where user_id = current_app_user()`,
      )
    ).rows[0] as { mode: string; startedOn: string | null; showCount: boolean } | undefined;
    const chapters = (
      await c.query(
        `select started_on::text as "startedOn", ended_on::text as "endedOn"
           from recovery_chapters where user_id = current_app_user() order by started_on desc`,
      )
    ).rows as { startedOn: string; endedOn: string | null }[];
    return { profile, chapters };
  });
}

function unitVec(k: number): number[] {
  const v = new Array<number>(1024).fill(0);
  v[k % 1024] = 1;
  return v;
}

async function main() {
  const today = iso(new Date());
  const start = addDays(today, -5);
  const userA = await makeUser('recA');
  const userB = await makeUser('recB');

  try {
    // --- Recovery-mode chapter state machine ---
    await setup(userA, start);
    let s = await snapshot(userA);
    check('setup: profile in chapter mode with the start date', s.profile?.mode === 'chapter' && s.profile?.startedOn === start, s.profile);
    check('setup: exactly one active chapter at the start date', s.chapters.length === 1 && s.chapters[0]?.endedOn === null && s.chapters[0]?.startedOn === start, s.chapters);
    check('setup: day count matches mode.ts (5 days)', daysSince(s.profile!.startedOn!, today) === 5, daysSince(s.profile!.startedOn ?? '', today));

    await beginAgain(userA, today);
    s = await snapshot(userA);
    const prior = s.chapters.find((c) => c.startedOn === start);
    const current = s.chapters.find((c) => c.endedOn === null);
    check('begin_again: two chapters now, prior one closed yesterday', s.chapters.length === 2 && prior?.endedOn === addDays(today, -1), s.chapters);
    check('begin_again: a new active chapter opened today', current?.startedOn === today, current);
    check('begin_again: profile start date moved to today (count resets, no shame)', s.profile?.startedOn === today && daysSince(s.profile!.startedOn!, today) === 0, s.profile);

    await withUser(userA, (c) => c.query(`update recovery_profiles set show_count = false where user_id = current_app_user()`));
    s = await snapshot(userA);
    check('preferences: show_count toggled off', s.profile?.showCount === false, s.profile);

    // --- user_bearings.principle_vec round-trip + recent-window ordering ---
    await withUser(userA, async (c) => {
      for (const [i, d] of [addDays(today, -1), today].entries()) {
        await c.query(
          `insert into user_bearings (user_id, ideology, local_date, principle, source_url, source_title, source_attribution, principle_vec)
           values (current_app_user(), 'aa', $1::date, $2, 'https://www.aa.org/', 'AA', 'AA', $3::vector)
           on conflict (user_id, ideology, local_date) do nothing`,
          [d, `read ${i}`, toVectorLiteral(unitVec(i))],
        );
      }
    });
    const recent = await withUser(userA, async (c) =>
      (
        await c.query(
          `select local_date::text as d, principle_vec from user_bearings
            where user_id = current_app_user() and principle_vec is not null
            order by local_date desc, created_at desc limit 45`,
        )
      ).rows as { d: string; principle_vec: unknown }[],
    );
    check('principle_vec: recent-window returns both reads, newest first', recent.length === 2 && recent[0]?.d === today, recent.map((r) => r.d));
    const parsed = typeof recent[0]?.principle_vec === 'string' ? JSON.parse(recent[0].principle_vec as string) : recent[0]?.principle_vec;
    check('principle_vec: stored vector round-trips as a 1024-dim array', Array.isArray(parsed) && parsed.length === 1024, Array.isArray(parsed) ? parsed.length : typeof parsed);

    // --- sponsor (private off-Crew contact) ---
    await withUser(userA, (c) =>
      c.query(`update recovery_profiles set sponsor_name = $1, sponsor_contact = $2 where user_id = current_app_user()`, ['Pat', 'text 555-0100']),
    );
    const sp = await withUser(userA, async (c) =>
      (await c.query(`select sponsor_name as n, sponsor_contact as ct from recovery_profiles where user_id = current_app_user()`)).rows[0] as { n: string; ct: string },
    );
    check('sponsor: private name + contact stored', sp?.n === 'Pat' && sp?.ct === 'text 555-0100', sp);

    // --- not-treatment ack round-trip (the exact accountability upsert) ---
    const ack = await withUser(userA, async (c) =>
      (
        await c.query(
          `insert into accountability_profiles (user_id, recovery_terms_acknowledged_at, updated_at)
           values (current_app_user(), now(), now())
           on conflict (user_id) do update set
             recovery_terms_acknowledged_at = coalesce(accountability_profiles.recovery_terms_acknowledged_at, now()), updated_at = now()
           returning recovery_terms_acknowledged_at is not null as "ack"`,
        )
      ).rows[0]?.ack,
    );
    check('ack: not-treatment acknowledgment persists', ack === true, ack);

    // --- followsRecovery + the bearing recoveryAck reads ---
    await withUser(userA, (c) =>
      c.query(`insert into user_schools (user_id, ideology, sort) values (current_app_user(), 'aa', 0) on conflict do nothing`),
    );
    const follows = await withUser(userA, async (c) =>
      (
        await c.query(
          `select exists(select 1 from user_schools where user_id = current_app_user() and ideology = any($1::text[])) as f`,
          [['aa', 'na', 'smart-recovery', 'recovery-dharma', 'secular-recovery']],
        )
      ).rows[0]?.f,
    );
    check('followsRecovery: true after following a recovery school', follows === true, follows);
    const bearingAck = await withUser(userA, async (c) =>
      (await c.query(`select recovery_terms_acknowledged_at is not null as ack from accountability_profiles where user_id = current_app_user()`)).rows[0]?.ack,
    );
    check('bearing recoveryAck: reflects the recorded ack', bearingAck === true, bearingAck);

    // --- RLS isolation: user B must not see user A's private recovery rows ---
    const bSeesProfiles = await withUser(userB, async (c) =>
      Number((await c.query(`select count(*)::int as n from recovery_profiles`)).rows[0].n),
    );
    const bSeesBearings = await withUser(userB, async (c) =>
      Number((await c.query(`select count(*)::int as n from user_bearings`)).rows[0].n),
    );
    check('RLS: user B sees none of user A recovery_profiles', bSeesProfiles === 0, bSeesProfiles);
    check('RLS: user B sees none of user A user_bearings', bSeesBearings === 0, bSeesBearings);

    // --- disable: profile removed, chapter history preserved ---
    await withUser(userA, async (c) => {
      await c.query(
        `update recovery_chapters set ended_on = greatest(started_on, $1::date)
          where user_id = current_app_user() and ended_on is null`,
        [today],
      );
      await c.query(`delete from recovery_profiles where user_id = current_app_user()`);
    });
    s = await snapshot(userA);
    check(
      'disable: profile removed, chapters preserved, and no chapter left active',
      s.profile === undefined && s.chapters.length === 2 && s.chapters.every((c) => c.endedOn !== null),
      { profile: s.profile, chapters: s.chapters },
    );
  } finally {
    // Self-clean: deleting the users cascades to their recovery + bearing rows.
    await owner.query(`delete from users where id = any($1::uuid[])`, [[userA, userB]]);
    await owner.end();
    await pool().end();
  }

  console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('harness error:', e instanceof Error ? e.stack : e);
  process.exit(2);
});
