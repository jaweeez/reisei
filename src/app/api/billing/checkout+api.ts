import { currentUser } from '@/server/auth/session';
import { adminPool } from '@/server/db';
import {
  appOrigin,
  billingEnabled,
  billingNotConfigured,
  parseInterval,
  priceRef,
  resolvePrice,
  stripe,
  type PlanKey,
} from '@/server/billing/stripe';

// POST /api/billing/checkout { plan: 'pro' | 'seat', interval, seats? } → Stripe
// Checkout URL. WEB rail only — mobile Pro is bought via RevenueCat/IAP, and Team
// seats are always web (per-seat can't run on IAP).
const MIN_SEATS = 3;

export async function POST(req: Request) {
  if (!billingEnabled()) return billingNotConfigured();
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let b: { plan?: unknown; interval?: unknown; seats?: unknown };
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const plan: PlanKey = b.plan === 'seat' ? 'seat' : 'pro';
  const interval = parseInterval(b.interval);
  const seats = plan === 'seat' ? Math.max(MIN_SEATS, Number(b.seats) || MIN_SEATS) : 1;

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
  // Premium posture: 7-day free trial on individual Pro. Team seats (B2B) get none.
  const trialDays = plan === 'pro' ? 7 : undefined;
  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: seats }],
    subscription_data: { metadata: { userId, plan }, ...(trialDays ? { trial_period_days: trialDays } : {}) },
    metadata: { userId, plan },
    success_url: `${origin}/settings?checkout=success`,
    cancel_url: `${origin}/paywall?checkout=cancel`,
    allow_promotion_codes: true,
  });

  return Response.json({ url: session.url });
}
