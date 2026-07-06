import type Stripe from 'stripe';
import { adminPool } from '@/server/db';
import { billingEnabled, isPaidStatus, statusFromStripe, stripe, webhookSecret } from '@/server/billing/stripe';

// POST /api/webhooks/stripe — Stripe → us. The signature (verified against the RAW
// body) is the only auth. Everything is an idempotent UPSERT so replays are safe.
// Two plans, keyed by subscription metadata.plan:
//   'pro'  → users.plan (individual rail)
//   'seat' → subscriptions + seat_assignments (Team rail); entitlement.getEntitlement
//            reads the subscription status, so a paused/canceled sub auto-revokes.

function idOf(v: string | { id: string } | null | undefined): string | null {
  if (!v) return null;
  return typeof v === 'string' ? v : v.id;
}

function periodEnd(sub: Stripe.Subscription): string | null {
  const anySub = sub as unknown as { current_period_end?: number; items?: { data?: { current_period_end?: number }[] } };
  const unix = anySub.current_period_end ?? anySub.items?.data?.[0]?.current_period_end;
  return unix ? new Date(unix * 1000).toISOString() : null;
}

export async function POST(req: Request) {
  if (!billingEnabled() || !webhookSecret()) {
    return Response.json({ error: 'Billing not configured.' }, { status: 501 });
  }
  const sig = req.headers.get('stripe-signature');
  if (!sig) return Response.json({ error: 'Missing signature.' }, { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, sig, webhookSecret());
  } catch (e) {
    return Response.json({ error: `Invalid signature: ${e instanceof Error ? e.message : 'bad'}` }, { status: 400 });
  }

  const p = adminPool();
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const md = s.metadata ?? {};
        const userId = md.userId;
        const customer = idOf(s.customer);
        const subscription = idOf(s.subscription);
        if (!userId) break;
        if (md.plan === 'seat') {
          const sub = (await p.query(
            `insert into subscriptions (sponsor_id, provider, plan, status, stripe_subscription_id, stripe_customer_id)
             values ($1, 'stripe', 'team', 'active', $2, $3)
             on conflict (stripe_subscription_id) do update set status = 'active', stripe_customer_id = excluded.stripe_customer_id
             returning id`,
            [userId, subscription, customer],
          )).rows[0];
          // The sponsor holds a seat too, so their own tier becomes 'team'.
          if (sub?.id) {
            await p.query(
              `insert into seat_assignments (subscription_id, user_id) values ($1, $2) on conflict do nothing`,
              [sub.id, userId],
            );
          }
        } else {
          await p.query(`update users set plan = 'pro', stripe_customer_id = coalesce($2, stripe_customer_id) where id = $1`, [
            userId,
            customer,
          ]);
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const md = sub.metadata ?? {};
        const userId = md.userId;
        if (md.plan === 'seat') {
          const qty = sub.items?.data?.[0]?.quantity ?? null;
          await p.query(
            `update subscriptions set status = $2, seats = coalesce($3, seats), current_period_end = $4 where stripe_subscription_id = $1`,
            [sub.id, statusFromStripe(sub.status), qty, periodEnd(sub)],
          );
        } else if (userId) {
          await p.query(`update users set plan = $2 where id = $1`, [userId, isPaidStatus(sub.status) ? 'pro' : 'free']);
        }
        break;
      }

      default:
        break;
    }
  } catch (e) {
    console.error('stripe webhook handler error:', e instanceof Error ? e.message : e);
    return Response.json({ error: 'handler error' }, { status: 500 });
  }

  return Response.json({ received: true });
}
