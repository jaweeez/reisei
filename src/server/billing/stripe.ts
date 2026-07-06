import Stripe from 'stripe';

// Server-only Stripe client + billing helpers. Imported ONLY by +api.ts routes.
// Billing is optional: everything is gated on STRIPE_SECRET_KEY, and endpoints
// return 501 when it isn't configured (the app runs on entitlements alone).
//
// TWO Stripe products (web rail only — mobile Pro is sold via RevenueCat/IAP):
//   PRO  — individual "Reisei Pro"      (quantity 1)
//   SEAT — leader-paid "Crew/Team" seat (quantity = seat count)
//
// Required env when billing is on:
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, EXPO_PUBLIC_APP_URL, and the price ids.

let _stripe: Stripe | null = null;

export function billingEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set');
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return _stripe;
}

export const webhookSecret = (): string => process.env.STRIPE_WEBHOOK_SECRET || '';

export type Interval = 'monthly' | 'annual';
export function parseInterval(v: unknown): Interval {
  return v === 'annual' ? 'annual' : 'monthly';
}
export type PlanKey = 'pro' | 'seat';

export function priceRef(plan: PlanKey, interval: Interval): string {
  if (plan === 'pro') {
    return (interval === 'annual' ? process.env.STRIPE_PRICE_PRO_ANNUAL : process.env.STRIPE_PRICE_PRO_MONTHLY) || '';
  }
  return (interval === 'annual' ? process.env.STRIPE_PRICE_SEAT_ANNUAL : process.env.STRIPE_PRICE_SEAT_MONTHLY) || '';
}
export const proIntervals = (): Interval[] => (['monthly', 'annual'] as const).filter((i) => Boolean(priceRef('pro', i)));
export const seatIntervals = (): Interval[] => (['monthly', 'annual'] as const).filter((i) => Boolean(priceRef('seat', i)));

// Each var may hold a PRICE id (price_…) or a PRODUCT id (prod_…); resolve prod_ → its
// default price, cached so repeat checkouts don't re-hit Stripe.
const priceCache = new Map<string, string>();
export async function resolvePrice(ref: string): Promise<string> {
  if (!ref) throw new Error('No price/product configured for this plan.');
  if (ref.startsWith('price_')) return ref;
  const cached = priceCache.get(ref);
  if (cached) return cached;
  if (ref.startsWith('prod_')) {
    const product = await stripe().products.retrieve(ref);
    let priceId = typeof product.default_price === 'string' ? product.default_price : (product.default_price?.id ?? null);
    if (!priceId) {
      const prices = await stripe().prices.list({ product: ref, active: true, limit: 1 });
      priceId = prices.data[0]?.id ?? null;
    }
    if (!priceId) throw new Error(`Stripe product ${ref} has no active price.`);
    priceCache.set(ref, priceId);
    return priceId;
  }
  return ref;
}

/** The public app origin for redirect URLs — env first, else the request's own origin. */
export function appOrigin(req: Request): string {
  const configured = process.env.EXPO_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, '');
  try {
    return new URL(req.url).origin;
  } catch {
    return '';
  }
}

export function billingNotConfigured(): Response {
  return Response.json(
    { error: 'Billing isn’t set up yet. Add STRIPE_SECRET_KEY and the price IDs on the server.' },
    { status: 501 },
  );
}

/** Map a Stripe subscription status to our subscriptions.status vocabulary. */
export function statusFromStripe(s: Stripe.Subscription.Status): 'active' | 'trialing' | 'paused' | 'canceled' {
  if (s === 'active') return 'active';
  if (s === 'trialing') return 'trialing';
  if (s === 'canceled' || s === 'incomplete_expired') return 'canceled';
  return 'paused';
}

/** Is this subscription status one that should grant the paid tier? */
export function isPaidStatus(s: Stripe.Subscription.Status): boolean {
  return s === 'active' || s === 'trialing';
}
