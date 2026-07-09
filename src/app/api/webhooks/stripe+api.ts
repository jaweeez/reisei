import type Stripe from 'stripe';
import { adminPool } from '@/server/db';
import { billingEnabled, isPaidStatus, statusFromStripe, stripe, webhookSecret } from '@/server/billing/stripe';

// POST /api/webhooks/stripe — Stripe → us. The signature (verified against the RAW
// body) is the only auth. Everything is an idempotent UPSERT so replays are safe.
// Three plans, keyed by subscription metadata.plan:
//   'pro'  → users.plan (individual rail)
//   'seat' → subscriptions + seat_assignments (a Corner's 2–8 seats, captain-sponsored)
//   'org'  → subscriptions bound to an org (9+ seats, multi-Corner); the owner is seated
//            immediately so the dashboard reflects reality without waiting for an event.
// entitlement.getEntitlement reads subscription status, so paused/canceled auto-revokes.

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
        const subscriptionId = idOf(s.subscription);
        if (!userId) break;

        if (md.plan === 'seat' || md.plan === 'org') {
          // Fetch the live subscription so seats/status/period are right IMMEDIATELY —
          // seat gating must not wait for a customer.subscription.updated to land. A failed
          // retrieve 500s so Stripe REDELIVERS (idempotent upsert): persisting placeholder
          // values here (seats 0 / status 'active') would clobber or starve the pool.
          let seats: number | null = null;
          let status = 'active';
          let period: string | null = null;
          if (subscriptionId) {
            try {
              const live = await stripe().subscriptions.retrieve(subscriptionId);
              seats = live.items?.data?.[0]?.quantity ?? null;
              status = statusFromStripe(live.status);
              period = periodEnd(live);
            } catch (e) {
              console.error('stripe retrieve failed; asking for redelivery:', e instanceof Error ? e.message : e);
              return Response.json({ error: 'subscription retrieve failed' }, { status: 500 });
            }
          }
          const sub = (await p.query(
            `insert into subscriptions (sponsor_id, provider, plan, status, seats, org_id, stripe_subscription_id, stripe_customer_id, current_period_end)
             values ($1, 'stripe', $2, $3, coalesce($4, 0), $5, $6, $7, $8)
             on conflict (stripe_subscription_id) do update
               set status = excluded.status,
                   seats = coalesce($4, subscriptions.seats),
                   org_id = coalesce(excluded.org_id, subscriptions.org_id),
                   stripe_customer_id = excluded.stripe_customer_id,
                   current_period_end = coalesce(excluded.current_period_end, subscriptions.current_period_end)
             returning id, seats`,
            [userId, md.plan === 'org' ? 'org' : 'team', status, seats, md.orgId ?? null, subscriptionId, customer, period],
          )).rows[0];
          // The sponsor holds a seat too (their own tier: 'team' via has_seat, or 'org' via
          // ownership). Capacity-guarded: if members already filled the pool (org_join runs
          // concurrently), don't push assignments past the purchased count.
          if (sub?.id) {
            await p.query(
              `insert into seat_assignments (subscription_id, user_id)
               select $1, $2
                where (select count(*) from seat_assignments where subscription_id = $1) < $3
               on conflict do nothing`,
              [sub.id, userId, Number(sub.seats ?? 0)],
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
        if (md.plan === 'seat' || md.plan === 'org') {
          const qty = sub.items?.data?.[0]?.quantity ?? null;
          const updated = await p.query(
            `update subscriptions set status = $2, seats = coalesce($3, seats), current_period_end = $4 where stripe_subscription_id = $1`,
            [sub.id, statusFromStripe(sub.status), qty, periodEnd(sub)],
          );
          // Event-ordering race: `updated` can land before `checkout.session.completed`.
          // Metadata carries everything needed to create the row now; completed then upserts.
          if (!updated.rowCount && userId) {
            await p.query(
              `insert into subscriptions (sponsor_id, provider, plan, status, seats, org_id, stripe_subscription_id, current_period_end)
               values ($1, 'stripe', $2, $3, coalesce($4, 0), $5, $6, $7)
               on conflict (stripe_subscription_id) do nothing`,
              [userId, md.plan === 'org' ? 'org' : 'team', statusFromStripe(sub.status), qty, md.orgId ?? null, sub.id, periodEnd(sub)],
            );
          }
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
