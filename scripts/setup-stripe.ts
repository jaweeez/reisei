import { config } from 'dotenv';
// Expo/Metro auto-loads .env.local; standalone tsx scripts do not.
config({ path: '.env.local' });
config({ path: '.env' });
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import Stripe from 'stripe';

// Idempotently creates the Reisei products + prices in your Stripe account and
// writes the resulting price ids into .env.local. Re-running reuses whatever
// already exists (matched by metadata), so it's safe to run more than once.
//
//   npm run setup:stripe
//
// Prereq: STRIPE_SECRET_KEY set to your sk_test_… key in .env.local.
// The premium pricing (see the monetization spec):
//   Pro  — $12.99/mo · $99/yr               (subscriber plus two covered people)
//   Crew — $24.99/mo · $199/yr              (flat plan for up to eight, web only)
//   Org  — $3.99/seat/mo · $39.99/seat/yr   (organization, 9+ seats, multi-Corner, web only)
//   Facility — $4.99/seat/mo · $49.99/seat/yr (sponsored Pro, 5+ seats, web only)

const CURRENCY = process.env.REISEI_CURRENCY || 'usd';
const WEBHOOK_URL = process.env.STRIPE_WEBHOOK_URL || 'https://www.reiseiapp.com/api/webhooks/stripe';
const WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
];

type ProductKey = 'pro' | 'seat' | 'org' | 'facility';

interface PriceSpec {
  envKey: string; // the .env var to write
  tag: string; // metadata.reisei_price — idempotency key
  product: ProductKey;
  amount: number; // in cents
  interval: 'month' | 'year';
  nickname: string;
}

const PRODUCTS: Record<ProductKey, { name: string; description: string }> = {
  pro: { name: 'Reisei Pro', description: 'One private Crew for three people, Line Cycles, full history, every school, and the full Log.' },
  seat: { name: 'Reisei Crew', description: 'One private Crew with full member access for up to eight people.' },
  org: { name: 'Reisei Org Seat', description: 'An organization seat (9+, volume pricing) for one covered member.' },
  facility: { name: 'Reisei Facility Seat', description: 'A facility-sponsored private Pro seat for one person, billed in pools of five or more.' },
};

const PRICES: PriceSpec[] = [
  { envKey: 'STRIPE_PRICE_PRO_MONTHLY', tag: 'pro_monthly_v15', product: 'pro', amount: 1299, interval: 'month', nickname: 'Reisei Pro 1.5 Monthly' },
  { envKey: 'STRIPE_PRICE_PRO_ANNUAL', tag: 'pro_annual_v15', product: 'pro', amount: 9900, interval: 'year', nickname: 'Reisei Pro 1.5 Annual' },
  { envKey: 'STRIPE_PRICE_SEAT_MONTHLY', tag: 'crew_monthly_v15', product: 'seat', amount: 2499, interval: 'month', nickname: 'Reisei Crew 1.5 Monthly' },
  { envKey: 'STRIPE_PRICE_SEAT_ANNUAL', tag: 'crew_annual_v15', product: 'seat', amount: 19900, interval: 'year', nickname: 'Reisei Crew 1.5 Annual' },
  { envKey: 'STRIPE_PRICE_ORG_MONTHLY', tag: 'org_monthly', product: 'org', amount: 399, interval: 'month', nickname: 'Reisei Org Seat — Monthly' },
  { envKey: 'STRIPE_PRICE_ORG_ANNUAL', tag: 'org_annual', product: 'org', amount: 3999, interval: 'year', nickname: 'Reisei Org Seat — Annual' },
  { envKey: 'STRIPE_PRICE_FACILITY_MONTHLY', tag: 'facility_monthly_v20', product: 'facility', amount: 499, interval: 'month', nickname: 'Reisei Facility Seat Monthly' },
  { envKey: 'STRIPE_PRICE_FACILITY_ANNUAL', tag: 'facility_annual_v20', product: 'facility', amount: 4999, interval: 'year', nickname: 'Reisei Facility Seat Annual' },
];

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

async function ensureProduct(stripe: Stripe, key: ProductKey): Promise<string> {
  // list is immediately consistent (search is eventually consistent) → dedupe reliably.
  const existing = (await stripe.products.list({ active: true, limit: 100 })).data.find(
    (p) => p.metadata?.reisei_plan === key,
  );
  if (existing) {
    console.log(`  = product ${key} → ${existing.id} (reused)`);
    return existing.id;
  }
  const created = await stripe.products.create({
    name: PRODUCTS[key].name,
    description: PRODUCTS[key].description,
    metadata: { reisei_plan: key },
  });
  console.log(`  + product ${key} → ${created.id} (created)`);
  return created.id;
}

async function ensurePrice(stripe: Stripe, spec: PriceSpec, productId: string): Promise<string> {
  const existing = (await stripe.prices.list({ product: productId, active: true, limit: 100 })).data.find(
    (p) => p.metadata?.reisei_price === spec.tag,
  );
  if (existing) {
    console.log(`  = price ${spec.tag} → ${existing.id} (reused)`);
    return existing.id;
  }
  const created = await stripe.prices.create({
    product: productId,
    currency: CURRENCY,
    unit_amount: spec.amount,
    recurring: { interval: spec.interval },
    nickname: spec.nickname,
    metadata: { reisei_price: spec.tag },
  });
  console.log(`  + price ${spec.tag} (${money(spec.amount)}/${spec.interval}) → ${created.id} (created)`);
  return created.id;
}

function writeEnv(values: Record<string, string>): void {
  const envPath = '.env.local';
  let env = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
  for (const [key, val] of Object.entries(values)) {
    if (new RegExp(`^${key}=`, 'm').test(env)) {
      env = env.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${val}`);
    } else {
      env = `${env.replace(/\n?$/, '')}\n${key}=${val}\n`;
    }
  }
  writeFileSync(envPath, env);
}

async function ensureWebhook(stripe: Stripe): Promise<Record<string, string>> {
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const configuredId = process.env.STRIPE_WEBHOOK_ENDPOINT_ID;
  const existing = endpoints.data.find(
    (endpoint) =>
      endpoint.status === 'enabled' &&
      (endpoint.id === configuredId || endpoint.url === WEBHOOK_URL),
  );

  if (existing && process.env.STRIPE_WEBHOOK_SECRET) {
    await stripe.webhookEndpoints.update(existing.id, {
      url: WEBHOOK_URL,
      enabled_events: WEBHOOK_EVENTS,
    });
    console.log(`  = webhook ${existing.id} (reused)`);
    return { STRIPE_WEBHOOK_ENDPOINT_ID: existing.id };
  }

  const created = await stripe.webhookEndpoints.create({
    url: WEBHOOK_URL,
    enabled_events: WEBHOOK_EVENTS,
    description: 'Reisei production subscription sync',
    metadata: { app: 'reisei' },
  });
  if (!created.secret) throw new Error('Stripe did not return a webhook signing secret.');
  console.log(`  + webhook ${created.id} (created)`);
  return {
    STRIPE_WEBHOOK_ENDPOINT_ID: created.id,
    STRIPE_WEBHOOK_SECRET: created.secret,
  };
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.includes('REPLACE')) {
    console.error('STRIPE_SECRET_KEY is not set. Put your sk_test_… key in .env.local first.');
    process.exit(1);
  }
  const mode = key.startsWith('sk_live') ? 'LIVE' : 'TEST';
  const stripe = new Stripe(key);
  console.log(`Setting up Reisei products/prices in Stripe (${mode} mode, ${CURRENCY.toUpperCase()})…\n`);

  const productIds: Record<ProductKey, string> = {
    pro: await ensureProduct(stripe, 'pro'),
    seat: await ensureProduct(stripe, 'seat'),
    org: await ensureProduct(stripe, 'org'),
    facility: await ensureProduct(stripe, 'facility'),
  };

  const envValues: Record<string, string> = {};
  for (const spec of PRICES) {
    envValues[spec.envKey] = await ensurePrice(stripe, spec, productIds[spec.product]);
  }

  Object.assign(envValues, await ensureWebhook(stripe));
  const revenueCatAuth = process.env.REVENUECAT_WEBHOOK_AUTH ?? '';
  if (
    process.env.ROTATE_REVENUECAT_WEBHOOK_AUTH === '1' ||
    !revenueCatAuth ||
    /replace|change|example|your|todo/i.test(revenueCatAuth)
  ) {
    envValues.REVENUECAT_WEBHOOK_AUTH = `Bearer ${randomBytes(32).toString('hex')}`;
    console.log('  + RevenueCat webhook authorization generated');
  }

  writeEnv(envValues);
  console.log(`\n✓ Wrote billing ids and secrets to .env.local.`);
  console.log('\nNext:');
  console.log('  1. Copy the STRIPE_PRICE_* lines into your Vercel project env.');
  console.log('  2. Copy STRIPE_WEBHOOK_SECRET and REVENUECAT_WEBHOOK_AUTH into the production server env.');
  await Promise.resolve();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
