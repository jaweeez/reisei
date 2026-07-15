import type { PoolClient } from 'pg';
import { adminPool } from '@/server/db';
import { makeCode } from '@/server/codes';

// Org + seat-distribution store. Owner-role (adminPool) like the billing routes: orgs and
// seats span users, so RLS-scoped app queries can't serve the owner dashboard. Every write
// is ownership-checked in the calling route; every seat mutation locks the subscription row
// (FOR UPDATE) before counting so a quantity can't be raced past.

export interface OrgSummary {
  id: string;
  name: string;
}

export interface OrgOverview {
  id: string;
  name: string;
  /** 'active' | 'trialing' | 'paused' | 'canceled' | 'none' (no subscription yet). */
  status: string;
  seats: { total: number; used: number };
  members: { id: string; name: string; username: string; seated: boolean; cornerName: string | null }[];
  corners: { id: string; name: string; memberCount: number }[];
  invites: { code: string; crewId: string | null; cornerName: string | null; createdAt: string }[];
}

export type SeatResult = { ok: true; seats: { total: number; used: number } } | { ok: false; reason: 'no_sub' | 'no_seat' | 'not_assigned' };

/** Create an org owned by userId (owner also becomes a member). Corners the owner already
 *  captains are adopted into the org — they are the owner's groups; the dashboard should
 *  see them from day one. Null if they already own an org. */
export async function createOrg(userId: string, name: string): Promise<OrgSummary | null> {
  const client = await adminPool().connect();
  try {
    await client.query('begin');
    const org = (
      await client.query(`insert into orgs (name, owner_id) values ($1, $2) returning id, name`, [name, userId])
    ).rows[0] as OrgSummary;
    await client.query(`insert into org_members (org_id, user_id, role) values ($1, $2, 'owner')`, [org.id, userId]);
    await client.query(
      `update crews set org_id = $1
        where captain_id = $2 and org_id is null`,
      [org.id, userId],
    );
    await client.query('commit');
    return org;
  } catch (e) {
    try { await client.query('rollback'); } catch { /* ignore */ }
    if ((e as { code?: string }).code === '23505') return null; // orgs_owner_uidx: one org per owner
    throw e;
  } finally {
    client.release();
  }
}

export async function renameOrg(orgId: string, name: string): Promise<void> {
  await adminPool().query(`update orgs set name = $1 where id = $2`, [name, orgId]);
}

/** The org this user owns, or null. */
export async function orgOwnedBy(userId: string): Promise<OrgSummary | null> {
  const { rows } = await adminPool().query(`select id, name from orgs where owner_id = $1`, [userId]);
  return (rows[0] as OrgSummary) ?? null;
}

/** Everything the owner dashboard shows, in one round trip per section. */
export async function orgOverview(orgId: string): Promise<OrgOverview | null> {
  const p = adminPool();
  const org = (await p.query(`select id, name from orgs where id = $1`, [orgId])).rows[0] as OrgSummary | undefined;
  if (!org) return null;

  const sub = (
    await p.query(
      `select id, status, seats from subscriptions
        where org_id = $1
        order by (status in ('active','trialing')) desc, created_at desc
        limit 1`,
      [orgId],
    )
  ).rows[0] as { id: string; status: string; seats: number } | undefined;

  const used = sub
    ? Number((await p.query(`select count(*)::int n from seat_assignments where subscription_id = $1`, [sub.id])).rows[0].n)
    : 0;

  const members = (
    await p.query(
      `select u.id, u.name, u.username,
              exists(select 1 from seat_assignments sa where sa.subscription_id = $2 and sa.user_id = u.id) as seated,
              (select c.name from crew_members cm join crews c on c.id = cm.crew_id
                where cm.user_id = u.id and c.org_id = $1
                order by cm.joined_at limit 1) as corner_name
         from org_members om join users u on u.id = om.user_id
        where om.org_id = $1
        order by om.joined_at`,
      [orgId, sub?.id ?? '00000000-0000-0000-0000-000000000000'],
    )
  ).rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    username: r.username as string,
    seated: !!r.seated,
    cornerName: (r.corner_name as string) ?? null,
  }));

  const corners = (
    await p.query(
      `select c.id, c.name, (select count(*)::int from crew_members cm where cm.crew_id = c.id) as member_count
         from crews c where c.org_id = $1 order by c.created_at`,
      [orgId],
    )
  ).rows.map((r) => ({ id: r.id as string, name: r.name as string, memberCount: Number(r.member_count) }));

  const invites = (
    await p.query(
      `select oi.code, oi.crew_id, c.name as corner_name, oi.created_at
         from org_invites oi left join crews c on c.id = oi.crew_id
        where oi.org_id = $1 and oi.revoked_at is null
        order by oi.created_at desc`,
      [orgId],
    )
  ).rows.map((r) => ({
    code: r.code as string,
    crewId: (r.crew_id as string) ?? null,
    cornerName: (r.corner_name as string) ?? null,
    createdAt: new Date(r.created_at as string).toISOString(),
  }));

  return {
    id: org.id,
    name: org.name,
    status: sub?.status ?? 'none',
    seats: { total: sub?.seats ?? 0, used },
    members,
    corners,
    invites,
  };
}

// ---------------------------------------------------------------------------
// Seat distribution — shared by the org dashboard and the Corner captain.
// ---------------------------------------------------------------------------

async function mutateSeat(
  findSub: (c: PoolClient) => Promise<{ id: string; seats: number } | undefined>,
  targetUserId: string,
  action: 'assign' | 'release',
): Promise<SeatResult> {
  const client = await adminPool().connect();
  try {
    await client.query('begin');
    const sub = await findSub(client); // FOR UPDATE inside — serializes seat mutations
    if (!sub) {
      await client.query('rollback');
      return { ok: false, reason: 'no_sub' };
    }
    if (action === 'assign') {
      const already = (
        await client.query(`select 1 from seat_assignments where subscription_id = $1 and user_id = $2`, [sub.id, targetUserId])
      ).rowCount;
      if (!already) {
        const used = Number(
          (await client.query(`select count(*)::int n from seat_assignments where subscription_id = $1`, [sub.id])).rows[0].n,
        );
        if (used >= sub.seats) {
          await client.query('rollback');
          return { ok: false, reason: 'no_seat' };
        }
        await client.query(`insert into seat_assignments (subscription_id, user_id) values ($1, $2)`, [sub.id, targetUserId]);
      }
    } else {
      const del = await client.query(`delete from seat_assignments where subscription_id = $1 and user_id = $2`, [
        sub.id,
        targetUserId,
      ]);
      if (!del.rowCount) {
        await client.query('rollback');
        return { ok: false, reason: 'not_assigned' };
      }
    }
    const used = Number(
      (await client.query(`select count(*)::int n from seat_assignments where subscription_id = $1`, [sub.id])).rows[0].n,
    );
    await client.query('commit');
    return { ok: true, seats: { total: sub.seats, used } };
  } catch (e) {
    try { await client.query('rollback'); } catch { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }
}

/** Assign/release a seat on the org's active subscription. */
export function orgSeat(orgId: string, targetUserId: string, action: 'assign' | 'release'): Promise<SeatResult> {
  return mutateSeat(
    async (c) =>
      (
        await c.query(
          `select id, seats from subscriptions
            where org_id = $1 and status in ('active','trialing')
            order by created_at desc limit 1 for update`,
          [orgId],
        )
      ).rows[0],
    targetUserId,
    action,
  );
}

// NOTE the plan vocabulary split: Stripe checkout metadata says 'seat' | 'org', but the
// subscriptions.plan COLUMN stores 'team' (a Corner-seat sub) | 'org' — the webhook maps
// metadata 'seat' → plan 'team'. Corner-pool queries therefore match plan = 'team'.

/** Assign/release a seat on a Corner captain's active Corner-seat subscription. */
export function cornerSeat(sponsorId: string, targetUserId: string, action: 'assign' | 'release'): Promise<SeatResult> {
  return mutateSeat(
    async (c) =>
      (
        await c.query(
          `select id, seats from subscriptions
            where sponsor_id = $1 and plan = 'team' and org_id is null and status in ('active','trialing')
            order by created_at desc limit 1 for update`,
          [sponsorId],
        )
      ).rows[0],
    targetUserId,
    action,
  );
}

/** A Corner captain's seat pool (for the crew screen), or null without a Corner-seat sub. */
export async function cornerSeatPool(sponsorId: string): Promise<{ total: number; used: number; seatedUserIds: string[] } | null> {
  const p = adminPool();
  const sub = (
    await p.query(
      `select id, seats from subscriptions
        where sponsor_id = $1 and plan = 'team' and org_id is null and status in ('active','trialing')
        order by created_at desc limit 1`,
      [sponsorId],
    )
  ).rows[0] as { id: string; seats: number } | undefined;
  if (!sub) return null;
  const rows = (await p.query(`select user_id from seat_assignments where subscription_id = $1`, [sub.id])).rows;
  return { total: sub.seats, used: rows.length, seatedUserIds: rows.map((r) => r.user_id as string) };
}

/** Direct Pro covers the subscriber plus two invited members. */
export async function proCoveragePool(
  sponsorId: string,
): Promise<{ total: number; used: number; seatedUserIds: string[] } | null> {
  const p = adminPool();
  const sponsor = (await p.query(`select plan from users where id = $1`, [sponsorId])).rows[0] as { plan?: string } | undefined;
  if (sponsor?.plan !== 'pro') return null;
  const rows = (await p.query(`select user_id from pro_covered_members where sponsor_id = $1 order by created_at`, [sponsorId])).rows;
  return { total: 3, used: 1 + rows.length, seatedUserIds: [sponsorId, ...rows.map((r) => r.user_id as string)] };
}

export async function proCoverage(
  sponsorId: string,
  targetUserId: string,
  action: 'assign' | 'release',
): Promise<SeatResult> {
  const client = await adminPool().connect();
  try {
    await client.query('begin');
    const sponsor = (await client.query(`select plan from users where id = $1 for update`, [sponsorId])).rows[0] as
      | { plan?: string }
      | undefined;
    if (sponsor?.plan !== 'pro') {
      await client.query('rollback');
      return { ok: false, reason: 'no_sub' };
    }
    if (action === 'assign') {
      const already = (
        await client.query(`select 1 from pro_covered_members where sponsor_id = $1 and user_id = $2`, [sponsorId, targetUserId])
      ).rowCount;
      if (!already) {
        const used = Number(
          (await client.query(`select count(*)::int n from pro_covered_members where sponsor_id = $1`, [sponsorId])).rows[0].n,
        );
        if (used >= 2) {
          await client.query('rollback');
          return { ok: false, reason: 'no_seat' };
        }
        await client.query(
          `insert into pro_covered_members (sponsor_id, user_id) values ($1, $2)
           on conflict (sponsor_id, user_id) do nothing`,
          [sponsorId, targetUserId],
        );
      }
    } else {
      const removed = await client.query(`delete from pro_covered_members where sponsor_id = $1 and user_id = $2`, [
        sponsorId,
        targetUserId,
      ]);
      if (!removed.rowCount) {
        await client.query('rollback');
        return { ok: false, reason: 'not_assigned' };
      }
    }
    const covered = Number(
      (await client.query(`select count(*)::int n from pro_covered_members where sponsor_id = $1`, [sponsorId])).rows[0].n,
    );
    await client.query('commit');
    return { ok: true, seats: { total: 3, used: 1 + covered } };
  } catch (e) {
    try { await client.query('rollback'); } catch { /* ignore */ }
    if ((e as { code?: string }).code === '23505') return { ok: false, reason: 'no_seat' };
    throw e;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Org invites
// ---------------------------------------------------------------------------

/** Mint an org invite, optionally landing joiners in a specific org Corner. */
export async function mintOrgInvite(orgId: string, createdBy: string, crewId: string | null): Promise<string | null> {
  const p = adminPool();
  if (crewId) {
    const owns = (await p.query(`select 1 from crews where id = $1 and org_id = $2`, [crewId, orgId])).rowCount;
    if (!owns) return null;
  }
  const code = makeCode();
  await p.query(`insert into org_invites (org_id, code, crew_id, created_by) values ($1, $2, $3, $4)`, [
    orgId,
    code,
    crewId,
    createdBy,
  ]);
  return code;
}

export async function revokeOrgInvite(orgId: string, code: string): Promise<boolean> {
  const res = await adminPool().query(
    `update org_invites set revoked_at = now() where org_id = $1 and code = $2 and revoked_at is null`,
    [orgId, code],
  );
  return (res.rowCount ?? 0) > 0;
}
