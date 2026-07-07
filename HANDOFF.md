# Reisei — Handoff

Last updated 2026-07-07. Repo: `github.com/jaweeez/reisei` · local: `/Users/muworksllc/muworks/Reisei/reisei`.
Everything below is committed and pushed (HEAD = `4afcc6c`). Sibling apps live one dir up
(`../Enso`, `../MuWorksModules`) — Reisei follows their house stack.

## What Reisei is

A composure-training app: you hold ONE named **Line** (a standard, e.g. "In bed by 23:00")
and each day report **held / broke / dark** in front of a **crew** that witnesses it.
"冷静 — stay level. A coach, not a counselor."

**Positioning is load-bearing** — read `docs/VOICE.md` first. Reisei smuggles evidence-based
mental-health practice to a discipline-minded audience by removing therapy-coded language,
never the medicine. Every mechanic is one real practice in a discipline costume. There's a
hard banned-words list; honor it in all copy.

## Stack

One **Expo** codebase → iOS / Android / Web (`expo-router` + `react-native-web`). Backend is
Expo Router API routes (`src/app/api/**+api.ts`) deployed to **Vercel** (`api/index.ts` via
`expo-server/adapter/vercel`). **Neon** Postgres via raw `pg`, **two roles + RLS**. Auth =
username+PIN (bcrypt) + opaque sessions. Coach RAG = Tavily→Voyage→Claude. Payments =
Stripe (web) + RevenueCat (mobile IAP) → one entitlement.

## Build status

| Area | State |
|---|---|
| Auth (username+PIN, sessions, RLS) | ✅ live |
| **P6 The Line** — verdicts (held/broke/dark), streak + **integrity** | ✅ live, 10 unit tests |
| Crew + **P7 Witness** — create/join/invite, posture roster, acks (SEEN/RESPECT/STAND UP) | ✅ live |
| **P8 Coach** — cron nudge engine + string table; RAG coach (`/api/coach`) | ✅ live (see caveats) |
| **P9 Ledger** (Pro) — hold calendar, break-clustering, retired archive | ✅ live |
| **Reset** — 60s box-breathing + grounding (mindfulness Trojan horse) | ✅ live |
| Coach corpus (Stoicism/CBT/mindfulness) | ✅ **67 chunks embedded in Neon** |
| **P4 Billing** — Stripe + RevenueCat scaffolding, paywall, entitlements | 🟡 scaffolded, needs keys |
| AppSync realtime | ⬜ stubbed → poll-on-focus (`src/lib/realtime/crew.ts`) |
| Push delivery | 🟡 send path built; needs a real device token to land |
| **P10 The Unit** (crew standard, captain report, shared fate) | ⬜ not started |

## Database (Neon)

Migrations `0001`–`0009` are **all applied**. Two roles wired + verified:
- `neondb_owner` (via `DATABASE_URL`) — owner, BYPASSRLS. Migrations, ingest, webhooks, cron.
- `reisei_app` (via `APP_DATABASE_URL`) — restricted, NOBYPASSRLS. All request-time queries
  run under `withUser()` which sets `app.current_user_id` so RLS enforces.

Tables: `users`, `sessions`, `lines`, `check_ins`, `streaks`, `line_events`, `crews`,
`crew_members`, `crew_invites`, `crew_acks`, `nudges`, `practices`, `subscriptions`,
`seat_assignments`, `device_tokens`, `teaching_chunks` (pgvector). One real user exists (the
founder's own test account) — don't wipe it.

## Env & accounts (`.env.local`, gitignored)

**Real / working:** `DATABASE_URL`, `APP_DATABASE_URL` (Neon), `ANTHROPIC_API_KEY`,
`VOYAGE_API_KEY`, `TAVILY_API_KEY` (pulled from Enso), `AUTH_SESSION_SECRET`, domain
`reiseiapp.com`.

**Still placeholders (need real values):** `STRIPE_*` (secret, webhook, price ids),
`EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `REVENUECAT_*`, `AWS_*` + `SES_*` + `CLOUDFRONT_*` +
`REISEI_AWS_S3_BUCKET`, `APPSYNC_*`, `UPSTASH_*`, `INNGEST_*`, `SENTRY_*`, `CRON_SECRET`,
`EXPO_ACCESS_TOKEN`, and the EAS `projectId` in `app.json`.

> AWS/SES creds can be pulled from `../Enso/ens-/.env.local` the same way the AI keys were
> (same AWS account). Reisei's SES sender is `noreply@reiseiapp.com` (verify that domain).

## Dev workflow

```bash
npm install
npm run web            # iOS/Android: npm run ios / npm run android
npm run typecheck      # tsc --noEmit
npm test               # jest — 20 tests (streak + coach nudge engine)

npm run db:migrate     # apply db/migrations/*.sql (owner)
npm run db:provision   # (re)create reisei_app role + APP_DATABASE_URL
npm run ingest         # embed the coach corpus (curated + Tavily scrape)
npm run ingest -- --curated-only
npm run setup:stripe   # create Stripe products/prices once STRIPE_SECRET_KEY is set
```

Docs: `README.md`, `docs/VOICE.md` (read first), `docs/STRIPE.md`, `docs/CORPUS.md`.

## Outstanding work (rough priority)

1. **Ship to a real device / TestFlight.** Set EAS `projectId`, add app icons/splash, run an
   EAS build. This unblocks real push delivery + IAP testing.
2. **Go live on billing.** `npm run setup:stripe`; set up the Stripe webhook →
   `STRIPE_WEBHOOK_SECRET`; create RevenueCat products (needs App Store Connect / Play Console)
   and set the RC keys.
3. **Deploy to Vercel.** Add domain `reiseiapp.com`; copy every server env var into the Vercel
   project; **switch both DB URLs to the Neon `-pooler` host** for serverless; set `CRON_SECRET`
   (the hourly `/api/coach/tick` cron is already in `vercel.json`).
4. **P10 — The Unit:** crew shared standard, captain's daily report, shared-fate math (spec in
   the product design; see memory / the "Hold the Line" workflow output).
5. **Escalation ladder** (each an evidence-based practice in costume — `practices` table + kind
   enum already support them): weekly **Debrief**, **Raise-the-bar** kaizen nudge,
   **Premeditation** prompt.
6. **AppSync realtime:** provision the AWS AppSync Events app + reuse the authorizer in
   `../MuWorksModules/infra/realtime-authorizer`; then flesh out `src/lib/realtime/crew.ts`.
7. **SES:** verify `reiseiapp.com`, request production access (sandbox by default).
8. Minor: tune the coach retrieval similarity floor (`0.3` in `src/server/ai/vector.ts` — a hair
   high; scholarly SEP chunks can crowd out curated aphorisms); add verified CBT/mindfulness web
   sources to `src/data/corpus/teachings.json`.

## Gotchas / notes for the next session

- **Testing a running dev server:** the first request triggers a ~30–60s Metro bundle. Don't
  busy-wait (connection-refused returns instantly); use
  `curl --retry 50 --retry-connrefused --retry-delay 3` to wait it out. Foreground `sleep` is
  blocked in this harness.
- **Client base URL:** web calls the API **same-origin** (empty base). Native uses
  `EXPO_PUBLIC_API_URL` — set it to your Mac's LAN URL for local native testing.
- **`date` columns** come back from `pg` as JS `Date` (serialize to ISO). We `to_char(..,'YYYY-MM-DD')`
  in queries where the client contract wants a plain date string — keep that pattern.
- **`crews.captain_id` is ON DELETE RESTRICT** — delete a crew before deleting its captain
  (matters for test cleanup).
- `DATABASE_URL` carries `&channel_binding=require`; the `pg` driver tolerates it (we strip
  `sslmode=require` and set ssl explicitly in `src/server/db.ts`).
- Memory for this project lives in `~/.claude/projects/-Users-muworksllc-muworks-Reisei/memory/`
  (`muworks-house-stack`, `reisei-app`) — kept current with product direction + strategy.
