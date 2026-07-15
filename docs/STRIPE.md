# Stripe setup

Reisei's **web** billing rail. (Mobile Pro is bought via RevenueCat/IAP; Team seats
are web-only.) One `entitlement` tier is the source of truth — Stripe + RevenueCat
webhooks feed it. See `src/server/billing/stripe.ts` and `src/app/api/billing/*`.

## 1. Keys

From the Stripe Dashboard → Developers → API keys, put your **test** key in `.env.local`:

```
STRIPE_SECRET_KEY=sk_test_…
# publishable key is optional — we use Stripe-hosted Checkout (a redirect), no Stripe.js
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…
```

## 2. Products & prices (scripted)

```bash
npm run setup:stripe
```

Idempotently creates two products and four prices, then writes the ids into `.env.local`:

| Env var | Plan | Price |
|---|---|---|
| `STRIPE_PRICE_PRO_MONTHLY` | Reisei Pro | $12.99 / mo |
| `STRIPE_PRICE_PRO_ANNUAL` | Reisei Pro | $99 / yr |
| `STRIPE_PRICE_SEAT_MONTHLY` | Reisei Crew | $24.99 / mo |
| `STRIPE_PRICE_SEAT_ANNUAL` | Reisei Crew | $199 / yr |

Pro carries a **7-day free trial** (applied at Checkout in `billing/checkout+api.ts`).
Team seats bill by `quantity` (min 3 seats), no trial.

## 3. Webhook → `STRIPE_WEBHOOK_SECRET`

The handler is `src/app/api/webhooks/stripe+api.ts`. It verifies the raw-body
signature and upserts entitlement idempotently. Enable these events:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

**Local dev** (gives you a `whsec_` for `.env.local`):

```bash
stripe listen --forward-to localhost:8083/api/webhooks/stripe
# copy the printed whsec_… into STRIPE_WEBHOOK_SECRET
```

**Production**: use `https://www.reiseiapp.com/api/webhooks/stripe`. The setup script
creates or updates the endpoint and stores its signing secret locally; copy that value
into the Vercel production env as `STRIPE_WEBHOOK_SECRET`.

## 4. Test the flow

```bash
stripe trigger checkout.session.completed
# or run a real test checkout from the /paywall screen with card 4242 4242 4242 4242
```

Then confirm the tier lifted: `GET /api/billing/status` → `tier: "pro"`.

## Notes

- **Never** put a Stripe card form inside the iOS/Android app — instant rejection.
  Mobile digital subs go through IAP (RevenueCat). Stripe is web-only.
- Copy every `STRIPE_*` line into the Vercel project env for production.
- Enroll **Stripe Tax** and the **Customer Portal** (Dashboard → Settings) so the
  `billing/portal` route works.
