import { adminPool } from '@/server/db';

// POST /api/webhooks/revenuecat — RevenueCat → us. Keeps users.plan in sync with the
// App Store / Play subscription so the entitlement lifts on a mobile IAP purchase.
// Authenticated by the shared secret on the RC webhook (Authorization header).
// app_user_id is our own user uuid (set via configureIap on the client).

const GRANT = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
]);
// CANCELLATION only stops auto-renew — access continues until EXPIRATION.
const REVOKE = new Set(['EXPIRATION']);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const secret = process.env.REVENUECAT_WEBHOOK_AUTH;
  if (!secret) return Response.json({ error: 'not configured' }, { status: 503 });
  if (req.headers.get('authorization') !== secret) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { event?: { type?: unknown; app_user_id?: unknown } };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const ev = body.event;
  const type = typeof ev?.type === 'string' ? ev.type : '';
  const userId = typeof ev?.app_user_id === 'string' ? ev.app_user_id : '';
  if (!UUID_RE.test(userId)) return Response.json({ ok: true });

  const p = adminPool();
  if (GRANT.has(type)) {
    await p.query(`update users set plan = 'pro' where id = $1`, [userId]);
  } else if (REVOKE.has(type)) {
    // Only clear a plan we set via IAP; never downgrade a team-seated user's row.
    await p.query(`update users set plan = 'free' where id = $1 and plan = 'pro'`, [userId]);
  }
  return Response.json({ ok: true });
}
