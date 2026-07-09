import { currentUser } from '@/server/auth/session';
import { adminPool } from '@/server/db';
import {
  appOrigin,
  billingEnabled,
  billingNotConfigured,
  clampSeats,
  parseInterval,
  priceRef,
  resolvePrice,
  SEAT_RULES,
  stripe,
  type PlanKey,
} from '@/server/billing/stripe';

// POST /api/billing/checkout { plan: 'pro' | 'seat' | 'org', interval, seats?, orgId? }
// → Stripe Checkout URL. WEB rail only — mobile Pro is bought via RevenueCat/IAP, and
// per-seat plans are always web (seats can't run on IAP).
//   pro  — individual, quantity 1, 7-day trial.
//   seat — a Corner's worth (2–8), captain-sponsored.
//   org  — 9+ seats, no ceiling; requires an org the caller owns (created first in-app so
//          the session's metadata carries orgId for the webhook to bind).
export async function POST(req: Request) {
  if (!billingEnabled()) return billingNotConfigured();
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let b: { plan?: unknown; interval?: unknown; seats?: unknown; orgId?: unknown };
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const plan: PlanKey = b.plan === 'seat' ? 'seat' : b.plan === 'org' ? 'org' : 'pro';
  const interval = parseInterval(b.interval);
  const seats = clampSeats(plan, Number(b.seats));

  // One live Corner-seat plan per sponsor (a second would double-bill into a split,
  // unmanageable pool — the pool queries pick one sub). Grow seats via the portal instead.
  if (plan === 'seat') {
    const live = (
      await adminPool().query(
        `select 1 from subscriptions
          where sponsor_id = $1 and plan = 'team' and org_id is null and status in ('active','trialing')`,
        [userId],
      )
    ).rowCount;
    if (live) {
      return Response.json({ error: 'You already cover a Corner. Manage seats in billing.' }, { status: 409 });
    }
  }

  // Org checkout binds to an org the caller owns, and only one live plan per org.
  let orgId: string | null = null;
  if (plan === 'org') {
    orgId = typeof b.orgId === 'string' ? b.orgId : '';
    if (!orgId) return Response.json({ error: 'Missing orgId.' }, { status: 400 });
    const owns = (
      await adminPool().query(`select 1 from orgs where id = $1 and owner_id = $2`, [orgId, userId])
    ).rowCount;
    if (!owns) return Response.json({ error: 'That is not your organization.' }, { status: 403 });
    const live = (
      await adminPool().query(
        `select 1 from subscriptions where org_id = $1 and status in ('active','trialing')`,
        [orgId],
      )
    ).rowCount;
    if (live) {
      return Response.json({ error: 'This organization already has a plan. Manage it in billing.' }, { status: 409 });
    }
  }

  const ref = priceRef(plan, interval);
  if (!ref) return Response.json({ error: `No ${plan} price configured for ${interval}.` }, { status: 501 });

  // Reuse (or create) the Stripe customer tied to this user.
  const u = (await adminPool().query<{ stripe_customer_id: string | null; username: string }>(
    `select stripe_customer_id, username from users where id = $1`,
    [userId],
  )).rows[0];
  let customerId = u?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe().customers.create({ metadata: { userId } });
    customerId = customer.id;
    await adminPool().query(`update users set stripe_customer_id = $2 where id = $1`, [userId, customerId]);
  }

  const origin = appOrigin(req);
  const priceId = await resolvePrice(ref);
  // Premium posture: 7-day free trial on individual Pro. Seat plans (B2B) get none.
  const trialDays = plan === 'pro' ? 7 : undefined;
  const metadata: Record<string, string> = { userId, plan, ...(orgId ? { orgId } : {}) };
  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [
      {
        price: priceId,
        quantity: seats,
        // Let an org adjust its headcount right in Checkout; the plan floor holds.
        ...(plan === 'org'
          ? { adjustable_quantity: { enabled: true, minimum: SEAT_RULES.org.min, maximum: SEAT_RULES.org.max } }
          : {}),
      },
    ],
    subscription_data: { metadata, ...(trialDays ? { trial_period_days: trialDays } : {}) },
    metadata,
    success_url: plan === 'org' ? `${origin}/org?checkout=success` : `${origin}/settings?checkout=success`,
    cancel_url: `${origin}/paywall?checkout=cancel`,
    allow_promotion_codes: true,
  });

  return Response.json({ url: session.url });
}
