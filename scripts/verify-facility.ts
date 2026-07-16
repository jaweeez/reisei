/* eslint-disable import/first -- dotenv must load env before importing modules that read it */
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { randomUUID } from 'node:crypto';
import { directPool, pool } from '../src/server/db';
import { getEntitlement } from '../src/server/entitlement';

// Integration harness for facility-sponsored seats (Phase 1): the anonymous claim function, the seat
// cap, entitlement (a claim ⇒ `team` tier), and RLS (a client cannot read the facility). Runs the
// exact claim function the API calls, against a live Postgres, and self-cleans. Requires a DB.

const owner = directPool();
let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  console.log(`${cond ? '✓' : '✗'} ${name}${cond ? '' : `  — got: ${JSON.stringify(detail)}`}`);
  if (!cond) failures += 1;
}

async function makeUser(tag: string): Promise<string> {
  const id = randomUUID();
  await owner.query(`insert into users (id, name, username, pin_hash, tz) values ($1, $2, $3, 'x', 'UTC')`, [
    id,
    `FAC ${tag}`,
    `fac_${tag}_${id.slice(0, 8)}`,
  ]);
  return id;
}

async function claim(userId: string, code: string): Promise<{ claimed: boolean; note: string }> {
  return (await owner.query(`select claimed, note from facility_claim($1, $2)`, [userId, code])).rows[0];
}

async function main() {
  const admin = await makeUser('admin');
  const clientA = await makeUser('a');
  const clientB = await makeUser('b');
  let facId = '';

  try {
    // Facility + a funding subscription with ONE seat + a live code (what the admin API / webhook do).
    facId = (await owner.query(`insert into facilities (name, admin_user_id) values ('Test Facility', $1) returning id`, [admin])).rows[0].id;
    const sub = (
      await owner.query(
        `insert into subscriptions (sponsor_id, plan, status, seats, facility_id) values ($1, 'team', 'active', 1, $2) returning id`,
        [admin, facId],
      )
    ).rows[0].id as string;
    const code = 'TESTCODE9';
    await owner.query(`insert into facility_invites (facility_id, code, created_by) values ($1, $2, $3)`, [facId, code, admin]);

    // Claim grants a seat and full private Pro (team tier), standalone (no crew).
    const a1 = await claim(clientA, code);
    check('claim: valid code grants a seat', a1.claimed === true, a1);
    const entA = await getEntitlement(clientA);
    check('entitlement: claimer is team tier + premium', entA.tier === 'team' && entA.premium === true, entA);
    check('entitlement: claimer is NOT placed as a crew captain', entA.isCaptain === false, entA.isCaptain);

    // Idempotent: re-entering the same code is a no-op success.
    const a2 = await claim(clientA, code);
    check('claim: re-entering the same code is an idempotent success', a2.claimed === true, a2);

    // Seat cap: the single seat is taken, so the next client is refused.
    const b1 = await claim(clientB, code);
    check('claim: seat cap enforced (second claim refused, seat_full)', b1.claimed === false && b1.note === 'seat_full', b1);
    check('entitlement: refused client stays free', (await getEntitlement(clientB)).tier === 'free', 'not free');

    // Growing the pool lets the next client in.
    await owner.query(`update subscriptions set seats = 2 where id = $1`, [sub]);
    const b2 = await claim(clientB, code);
    check('claim: raising seats admits the next client', b2.claimed === true, b2);

    // A revoked code no longer works.
    await owner.query(`update facility_invites set revoked_at = now() where facility_id = $1`, [facId]);
    const c = await makeUser('c');
    const cr = await claim(c, code);
    check('claim: revoked code is rejected (invalid_code)', cr.claimed === false && cr.note === 'invalid_code', cr);
    await owner.query(`delete from users where id = $1`, [c]);

    // RLS: a client cannot read the facility (admin-only select policy).
    const clientSeesFacility = await (async () => {
      const client = await pool().connect();
      try {
        await client.query('begin');
        await client.query(`select set_config('app.current_user_id', $1, true)`, [clientA]);
        const n = Number((await client.query(`select count(*)::int as n from facilities`)).rows[0].n);
        await client.query('commit');
        return n;
      } finally {
        client.release();
      }
    })();
    check('RLS: a client sees no facility rows', clientSeesFacility === 0, clientSeesFacility);
  } finally {
    // Cleanup: subscription delete cascades seat_assignments; facility delete cascades invites; then
    // users (facilities.admin_user_id is ON DELETE RESTRICT, so the facility must go first).
    if (facId) {
      await owner.query(`delete from subscriptions where facility_id = $1`, [facId]);
      await owner.query(`delete from facilities where id = $1`, [facId]);
    }
    await owner.query(`delete from users where id = any($1::uuid[])`, [[admin, clientA, clientB]]);
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
