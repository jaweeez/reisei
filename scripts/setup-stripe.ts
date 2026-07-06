import { config } from 'dotenv';
// Expo/Metro auto-loads .env.local; standalone tsx scripts do not.
config({ path: '.env.local' });
config({ path: '.env' });
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import Stripe from 'stripe';

// Idempotently creates the Reisei products + prices in your Stripe account and
// writes the resulting price ids into .env.local. Re-running reuses whatever
// already exists (matched by metadata), so it's safe to run more than once.
//
//   npm run setup:stripe
//
// Prereq: STRIPE_SECRET_KEY set to your sk_test_… key in .env.local.
// The premium pricing (see the monetization spec):
//   Pro  — $6.99/mo · $49.99/yr   (individual; also sold on mobile via RevenueCat)
//   Seat — $4.99/seat/mo · $49.99/seat/yr   (Crew/Team; quantity = seats, web only)

const CURRENCY = process.env.REISEI_CURRENCY || 'usd';

interface PriceSpec {
  envKey: string; // the .env var to write
  tag: string; // metadata.reisei_price — idempotency key
  product: 'pro' | 'seat';
  amount: number; // in cents
  interval: 'month' | 'year';
  nickname: string;
}

const PRODUCTS: Record<'pro' | 'seat', { name: string; description: string }> = {
  pro: { name: 'Reisei Pro', description: 'Create & captain a crew, full history, streak insurance, widgets.' },
  seat: { name: 'Reisei Crew Seat', description: 'A sponsored Crew/Team seat — one comped Pro membership.' },
};

const PRICES: PriceSpec[] = [
  { envKey: 'STRIPE_PRICE_PRO_MONTHLY', tag: 'pro_monthly', product: 'pro', amount: 699, interval: 'month', nickname: 'Reisei Pro — Monthly' },
  { envKey: 'STRIPE_PRICE_PRO_ANNUAL', tag: 'pro_annual', product: 'pro', amount: 4999, interval: 'year', nickname: 'Reisei Pro — Annual' },
  { envKey: 'STRIPE_PRICE_SEAT_MONTHLY', tag: 'seat_monthly', product: 'seat', amount: 499, interval: 'month', nickname: 'Reisei Crew Seat — Monthly' },
  { envKey: 'STRIPE_PRICE_SEAT_ANNUAL', tag: 'seat_annual', product: 'seat', amount: 4999, interval: 'year', nickname: 'Reisei Crew Seat — Annual' },
];

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

async function ensureProduct(stripe: Stripe, key: 'pro' | 'seat'): Promise<string> {
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

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.includes('REPLACE')) {
    console.error('STRIPE_SECRET_KEY is not set. Put your sk_test_… key in .env.local first.');
    process.exit(1);
  }
  const mode = key.startsWith('sk_live') ? 'LIVE' : 'TEST';
  const stripe = new Stripe(key);
  console.log(`Setting up Reisei products/prices in Stripe (${mode} mode, ${CURRENCY.toUpperCase()})…\n`);

  const productIds: Record<'pro' | 'seat', string> = {
    pro: await ensureProduct(stripe, 'pro'),
    seat: await ensureProduct(stripe, 'seat'),
  };

  const envValues: Record<string, string> = {};
  for (const spec of PRICES) {
    envValues[spec.envKey] = await ensurePrice(stripe, spec, productIds[spec.product]);
  }

  writeEnv(envValues);
  console.log(`\n✓ Wrote ${Object.keys(envValues).length} price ids to .env.local.`);
  console.log('\nNext:');
  console.log('  1. Copy the STRIPE_PRICE_* lines into your Vercel project env.');
  console.log('  2. Set up the webhook → STRIPE_WEBHOOK_SECRET:');
  console.log('       local:  stripe listen --forward-to localhost:8083/api/webhooks/stripe');
  console.log('       prod:   add endpoint https://reiseiapp.com/api/webhooks/stripe');
  console.log('       events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted');
  await Promise.resolve();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
