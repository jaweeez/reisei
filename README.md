# Reisei

**Stay level.** Daily check-ins, streaks, and a crew that expects you to show up.
By Mu Works LLC · sibling to Ensō · [reiseiapp.com](https://reiseiapp.com)

One Expo codebase ships **iOS, Android, and Web**; the backend is Expo Router API
routes (`src/app/api/**+api.ts`) deployed to Vercel over Neon Postgres. Conventions
mirror the Ensō / MuWorks house stack.

## Stack

| Layer | Choice |
|---|---|
| App (iOS/Android/Web) | Expo (React Native) + `expo-router` + `react-native-web` |
| Backend/API | Expo Router API routes on Vercel (`api/index.ts` via `expo-server/adapter/vercel`) |
| Database | Neon Postgres via `pg`, two roles + Row-Level Security |
| Auth | Username + PIN (bcrypt), opaque server sessions; passkeys are the upgrade path |
| Payments | **Stripe** (web) + **RevenueCat** (mobile IAP) → one `entitlement` tier |
| Realtime | AWS AppSync Events (crew presence) — stubbed in `src/lib/realtime` |
| Media / email | AWS S3 + CloudFront / SES |

## Getting started

```bash
npm install
cp .env.example .env.local        # then fill in Neon + the rest

# database
npm run db:migrate                # apply db/migrations/*.sql (owner role)
npm run db:provision              # create the restricted RLS app role → APP_DATABASE_URL

# run
npm run web                       # or: npm run ios / npm run android
```

## Monetization

Hybrid from day one, premium, **free to join / pay to lead**:

- **Free** — solo check-ins, streaks, join invited crews.
- **Pro** ($12.99/mo · $99/yr) — one private Crew for the subscriber plus two invited people, Cycles, full history, and personalized Bearings.
  Sold on **both** rails (Stripe web + RevenueCat IAP).
- **Crew** ($24.99/mo · $199/yr) — flat plan for up to eight people; every covered member gets the complete member experience.
  **Stripe web only** (per-seat can't run on IAP).

One `entitlement` tier (`free|pro|team`) is the source of truth; Stripe + RevenueCat
webhooks feed it. In-app digital subs use Apple/Google IAP — a Stripe card form in
the native binary is an instant App Store rejection.

## Layout

```
api/                     Vercel entry (expo-server adapter)
db/migrations/           raw SQL (0001 schema · 0002 RLS · 0003 auth+crew funcs)
scripts/                 migrate.ts · provision-app-role.ts
src/app/                 screens (expo-router) + api/**+api.ts routes
src/server/              server-only: db, auth/session, entitlement, billing/stripe, streak
src/lib/                 client: auth, data, billing, iap, realtime
src/components/          Text · Screen · Button · Card · VialMark · CrewDots
src/theme/               ink/brass/bubble tokens + Big Shoulders / IBM Plex type
```
