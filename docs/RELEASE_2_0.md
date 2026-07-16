# Reisei 2.0 — go-live runbook

Ships together: recovery expansion (school families, 5 recovery schools, recovery mode, safety),
personalization gating (Pro), and facility-sponsored seats (Phase 1). Version bumped to 2.0.0.

## The one rule that matters

**Migrate the production database BEFORE deploying the new API.** The new server code reads/writes
columns and tables from migrations 0024–0029 (`principle_vec`, `address_register`,
`recovery_terms_acknowledged_at`, `recovery_profiles`, `facilities`, `subscriptions.facility_id`,
…). Deploy the code first and the Bearing / Log / check-in flows break for **every** user, not just
recovery ones.

The migrations are all **additive** (new tables, new nullable columns, one NOT NULL column with a
default). That means the reverse is safe: the **old** code runs fine against the **new** schema. So
the correct, low-risk order is expand → migrate → deploy:

1. Migrate prod (old app keeps working).
2. Deploy the new API.
3. Release the mobile app last.

## Confirm before you touch prod

- [x] **Which DB is production?** The migrations were applied to the DB behind `.env.local`. Confirm
      whether that is prod or a dev DB. `reiseiapp.com` (the API) uses prod — you need that connection
      string for the migrate step.
- [x] **Does merging `main` auto-deploy the API?** A `.vercel` project is present. If pushing/merging
      `main` triggers a Vercel prod deploy, you must migrate prod **before** the merge.
- [x] **Store prerequisites** from `todo.md` are still open (RevenueCat product setup, Play
      credentials, screenshots). Those gate the mobile submission (Phase 4), not the backend.

## Heads-up: a behavior change for existing free users

Personalization is now **Pro-gated**. Free users who were quietly getting struggle-tailored Bearings
will now get the neutral, shared, date-rotated one. This is intended (it honors the paywall), but it
is a visible change for current free users — expect some "my Bearing changed" and treat it as a Pro
upsell moment. Monitor and have copy ready.

## Phase 0 — Pre-flight (no prod impact)

- [ ] **Device QA**: run `docs/RECOVERY_QA.md` on a real 2.0 build (recovery schools, picker ack,
      recovery mode, register, log off-ramp) plus the facility console + claim flow. This is the
      gating step the screens have not had.
- [ ] **Commit + PR**: the work is uncommitted on `main`. Branch → PR → review → merge. Do not push
      straight to `main` until the migrate step (Phase 1) is done, if merging auto-deploys.
- [x] **Snapshot prod DB** (Neon PITR branch `br-restless-forest-adlgegl5`, 2026-07-16 05:15 UTC)
      so you can restore if a migration surprises you.
- [ ] **Stage the Stripe facility price** in test mode, then create the live price; capture its id.

## Phase 1 — Database (backward-compatible)

- [x] Apply migrations against **prod** with the direct (non-pooler) connection:
      `DIRECT_DATABASE_URL=<prod-direct-url> npm run db:migrate` → applies 0024–0029, idempotent.
- [x] **Grant the new tables to the app role.** Do NOT blindly run `db:provision` — it moves
      `APP_DATABASE_URL` to the low-cap non-pooler host (see memory). As the owner, verify/grant:
      `grant select, insert, update, delete on recovery_profiles, recovery_chapters, facilities,
      facility_invites to reisei_app;` (columns on existing tables inherit their table's grant).
- [x] **Verify** against prod (self-cleaning; ideally a staging copy, else a quiet window):
      `npm run db:verify-recovery` (16/16) and `npm run db:verify-facility` (9/9).

At this point the current live app is still running fine on the migrated schema.

## Phase 2 — Backend deploy

- [ ] Deploy the new API to prod (merge `main` / trigger Vercel). New endpoints go live.
- [ ] **Smoke test** as a real user (free AND pro):
  - Existing: `/api/state`, `/api/bearing`, `/api/checkin`, `/api/journal` all 200 and behave.
  - New: `/api/recovery-mode` (GET), `/api/profile` (GET), `/api/facility` (GET), and a
    `/api/facility/claim` with a bad code (expect a clean 404, not a 500).
  - Confirm a **free** user gets the neutral Bearing and a **Pro** user gets a personalized one.
- [ ] **Ingest the corpus** against prod (rebuilds `teaching_chunks` with the recovery sources;
      spends Voyage/Tavily credits): `npm run ingest` with the prod DB. Run in a low-traffic window
      (it deletes+rebuilds web chunks; keyword fallback covers the brief gap). Verify chunk counts
      (expect ~62 curated + ~400 web; all 5 recovery schools present).

## Phase 3 — Billing

- [ ] Add `STRIPE_PRICE_FACILITY_MONTHLY` / `STRIPE_PRICE_FACILITY_ANNUAL` to prod env; redeploy if
      the platform needs it to pick them up.
- [ ] End-to-end facility checkout in Stripe (test → live): buy seats → webhook writes a subscription
      with `facility_id` → generate a code → claim it on a second account → that account is `team`
      (Pro). Confirm the facility admin is **not** auto-seated.
- [ ] Regression: the existing Pro / Crew / Org checkouts still work (no change intended).

## Phase 4 — Mobile release (last)

- [ ] Close the `todo.md` store items (RevenueCat products/offerings, Play credentials, screenshots).
- [ ] `eas build --profile production --platform all` (version 2.0.0; `autoIncrement` handles build
      numbers).
- [ ] Ship to **TestFlight + Play internal** first; run the `RECOVERY_QA.md` checklist on the real
      build against the now-live prod backend.
- [ ] `eas submit --profile production --platform ios` and `--platform android`.
- [ ] After approval, use a **phased/staged rollout** (iOS phased release, Play staged %) so you can
      halt on a bad signal.

## Rollback

- **API bad after deploy:** revert the Vercel deployment to the previous build. The DB stays migrated
  — additive columns/tables are harmless to the old code.
- **A migration misbehaves:** restore from the Phase 0 snapshot (unlikely; all additive).
- **Mobile build bad:** halt the staged rollout; the live backend is unaffected. You cannot un-submit
  a review, which is exactly why the app goes last, after the backend is proven.

## Monitoring (first 48h)

- Vercel runtime logs / error rate on `/api/bearing`, `/api/state`, `/api/checkin`, `/api/journal`.
- Neon: connection count + latency (watch the connection cap — don't churn restarts).
- Stripe webhook success (facility + existing plans); any `subscription retrieve failed` 500s.
- Crash-free rate (App Store / Play consoles).
- Funnels: check-in completion, Bearing load, recovery-mode enable, facility claim, Pro conversion.
- Watch for free-user confusion about the personalization change (see the heads-up above).

## Go / no-go checklist

- [ ] Device QA passed on a real 2.0 build (recovery + facility).
- [ ] Prod DB migrated (0024–0029) + new tables granted + harnesses green.
- [ ] API deployed and smoke-tested; free vs Pro Bearing behavior confirmed.
- [ ] Corpus ingested on prod; recovery schools grounded.
- [ ] Stripe facility price live; facility checkout → claim → `team` verified.
- [ ] Store prerequisites closed; build on TestFlight/Play internal and QA'd.
- [ ] Rollback path confirmed (know how to revert the Vercel deploy).
