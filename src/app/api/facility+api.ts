import { randomBytes } from 'node:crypto';
import { currentUser } from '@/server/auth/session';
import { adminPool } from '@/server/db';

// GET  /api/facility → the caller's facility overview (anonymous counts + codes), or { facility: null }.
// POST /api/facility { op } → create | code | revoke. Writes use the owner role (no RLS write policy).
// The facility only ever sees seat counts here — never who claimed a seat (docs/FACILITY_SPONSORSHIP.md).

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I/L
function genCode(): string {
  return Array.from(randomBytes(9), (byte) => ALPHABET[byte % ALPHABET.length]).join('');
}

async function overview(facilityId: string) {
  const p = adminPool();
  const seats = (
    await p.query(
      `select coalesce(seats, 0) as total, status
         from subscriptions
        where facility_id = $1 and status in ('active', 'trialing')
        order by created_at desc limit 1`,
      [facilityId],
    )
  ).rows[0] as { total: number; status: string } | undefined;
  const claimed = Number(
    (
      await p.query(
        `select count(*)::int as n
           from seat_assignments sa join subscriptions s on s.id = sa.subscription_id
          where s.facility_id = $1`,
        [facilityId],
      )
    ).rows[0].n,
  );
  const codes = (
    await p.query(
      `select code, revoked_at is not null as revoked from facility_invites where facility_id = $1 order by created_at desc`,
      [facilityId],
    )
  ).rows as { code: string; revoked: boolean }[];
  return { seats: { total: Number(seats?.total ?? 0), claimed }, active: !!seats, codes };
}

async function myFacility(userId: string): Promise<{ id: string; name: string; billingMode: string } | null> {
  const row = (
    await adminPool().query(
      `select id, name, billing_mode as "billingMode" from facilities where admin_user_id = $1`,
      [userId],
    )
  ).rows[0];
  return row ?? null;
}

export async function GET(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });
  const facility = await myFacility(userId);
  if (!facility) return Response.json({ facility: null });
  return Response.json({ facility, ...(await overview(facility.id)) });
}

export async function POST(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let b: { op?: unknown; name?: unknown; code?: unknown } = {};
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const p = adminPool();

  if (b.op === 'create') {
    const name = typeof b.name === 'string' ? b.name.trim().slice(0, 120) : '';
    if (!name) return Response.json({ error: 'Name your facility.' }, { status: 400 });
    await p.query(
      `insert into facilities (name, admin_user_id) values ($1, $2)
       on conflict (admin_user_id) do update set name = excluded.name`,
      [name, userId],
    );
    const facility = await myFacility(userId);
    return Response.json({ facility, ...(await overview(facility!.id)) });
  }

  const facility = await myFacility(userId);
  if (!facility) return Response.json({ error: 'Create your facility first.' }, { status: 409 });

  if (b.op === 'code') {
    await p.query(`insert into facility_invites (facility_id, code, created_by) values ($1, $2, $3)`, [
      facility.id,
      genCode(),
      userId,
    ]);
    return Response.json({ facility, ...(await overview(facility.id)) });
  }

  if (b.op === 'revoke') {
    const code = typeof b.code === 'string' ? b.code : '';
    await p.query(
      `update facility_invites set revoked_at = now() where facility_id = $1 and code = $2 and revoked_at is null`,
      [facility.id, code],
    );
    return Response.json({ facility, ...(await overview(facility.id)) });
  }

  return Response.json({ error: 'Unknown facility operation.' }, { status: 400 });
}
