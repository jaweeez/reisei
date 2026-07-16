# Reisei — Facility-sponsored seats (scope)

Status: scoping. A **separate track** from the recovery expansion — it must not block or entangle
that release. Lets treatment facilities (rehabs, IOPs, sober living, therapist practices) fund Pro
access for the people they serve.

## Outcome

A facility buys a pool of seats and hands out codes. A person in recovery redeems a code and gets
**full private Pro, standalone** — no strings, no one watching. The facility sees only **anonymous
seat accounting**. A facility may optionally run groups a client can **opt into**, and only then does
the facility see that client's **group participation** (never logs, bearings, or notes).

This reuses the part Reisei already has: entitlement grants `team` tier (Pro-level) to anyone
holding an active **seat** funded by someone else's subscription (`entitlement.ts`). Facilities are a
new front door onto that idea, with a stricter privacy default than the existing Organization tier.

## Decisions locked

- **Privacy: opt-in facility groups.** Default on claim = standalone private Pro; facility sees only
  counts. A client may opt into a facility group, which shares *that client's group participation*
  (checked-in / held / attended) with the facility — nothing more, and revocable.
- **Billing: both.** Self-serve web card (Stripe per-seat) **and** an invoice / PO path for larger
  facilities. Never App Store IAP (seats are web-only; also dodges the 30%).
- **Build: a new Facility entity.** Purpose-built tables (`facilities`, `facility_seats`,
  `facility_invites`, `facility_groups`, `facility_group_members`), distinct from `orgs`. Shares the
  entitlement concept (an active facility seat ⇒ `team` tier) but keeps its own, stricter surface.

## Compliance guardrails (read first, not optional)

A facility sponsoring people in recovery is regulated territory. Design around it:

- **42 CFR Part 2** (federal confidentiality of substance-use-disorder records) and **HIPAA** likely
  apply the moment any client-identifiable participation reaches a facility. The **anonymous-seat
  default requires none of this** — that's why it is the default.
- **The group-visibility path needs explicit, informed, revocable consent** from the client
  ("Share my check-ins with [Facility]"). That consent is the legal basis for any disclosure. Build
  the consent as a first-class, logged, revocable record — never a buried default.
- **Never disclose content.** Logs, bearings, notes, recovery-mode details, and sponsor info are
  never visible to a facility, opted-in or not. Only participation signals (checked in / held /
  broke / attended), and only for a group the client opted into.
- **A facility likely needs a BAA** before the group path is enabled for them. Gate Phase 3 behind a
  legal review + a signed agreement flag on the facility record.
- **Anonymity by default.** A claimed seat does not reveal the claimer's identity to the facility.
  The facility invites by code, not by name.

If in doubt, the anonymous private-Pro seat is always safe; the group path is the only part that
touches regulated flows, and it is consent-gated.

## Data model (new)

- `facilities` — id, name, admin_user_id, billing_mode ('self_serve' | 'invoice'), baa_signed_at,
  created_at. (A facility admin is a normal user with an admin link, like an org owner.)
- `facility_seats` / seat pool — funded seats (total purchased) vs claimed. Modeled either as a
  count on a subscription row (self-serve, like org seats) or granted rows (invoice). An active
  claimed seat is what entitlement reads.
- `facility_invites` — revocable, reusable codes scoped to a facility (mirrors `org_invites`), used
  to claim a seat anonymously.
- `facility_claims` (or reuse `seat_assignments` with a facility_id) — the seat a user holds,
  granting `team` tier. Releasable when a client leaves (frees the seat).
- `facility_groups` — optional groups a facility runs (name, facility_id). Like crews, but a client
  joining is an explicit consent to share group participation.
- `facility_group_members` — user ↔ group, with `consent_at` (the disclosure consent) and
  `consent_revoked_at`.

## Entitlement wiring

Extend `getEntitlement` so an **active facility claim** grants `team` tier, exactly like a Corner /
org seat today (`has_seat`). Minimal change: add a facility-claim existence check to the same query.
A facility claim is standalone — it does **not** place the user in any crew or make them visible.

## The claim flow (anonymous, private Pro)

1. Facility admin buys N seats (billing below) and generates a code.
2. Client enters the code (web or app) → a `facility_claim` is created → entitlement returns `team`.
3. The client now has full private Pro. The facility's console shows "N of M claimed" — no identity.
4. Leaving: the client or facility releases the claim; the seat returns to the pool.

## Opt-in groups + consent (Phase 3, compliance-gated)

- A facility with a signed BAA can create `facility_groups`.
- A client can **join a group**, which surfaces a clear consent: "This lets [Facility] see whether
  you check in and hold your Line in this group. It never shows your log, bearings, or notes." Stored
  as `consent_at`, revocable any time (`consent_revoked_at`) which immediately stops the disclosure.
- The facility sees, for opted-in members only, group participation (checked-in / held / broke /
  attended) — the same posture the Crew sees, never content.

## Billing

- **Self-serve (Phase 1):** reuse the Stripe per-seat subscription flow the Org tier uses, on the
  web. Facility admin adjusts seat count; entitlement follows the active subscription.
- **Invoice / PO (Phase 2):** mark a facility `billing_mode = 'invoice'`; seats are granted by an
  internal/admin action against a signed agreement, entitlement honors granted seats regardless of a
  Stripe row. Keep it a thin manual/enterprise path first.

## Facility admin console (web)

Web-only (like seat management today). Buy/adjust seats, generate/revoke codes, see anonymous counts
(claimed / active), manage groups (Phase 3), and see opted-in group participation (Phase 3). No
client identities outside opted-in groups; no content ever.

## Phasing

- **Phase 1 — Anonymous seats + private Pro (self-serve). [DONE, pending Stripe price config]**
  Migrations 0028–0029 (`facilities`, `facility_invites`, `subscriptions.facility_id`, renewable
  subscription lookup, RLS, a
  `facility_claim` SECURITY DEFINER function). Claim reuses `seat_assignments` ⇒ `team` tier, so
  **no entitlement change** and the client is never crew-placed. `/api/facility/claim` (anonymous),
  `/api/facility` admin (create / code / revoke / counts), a `facility.tsx` console + a "claim a
  code" entry in Settings. Self-serve billing wired through the `facility` plan (Stripe checkout +
  webhook mirror `org`; the admin is NOT auto-seated). Active plans route to Stripe billing
  management for seat changes. **Verified:** tsc + 100 tests + web export +
  `scripts/verify-facility.ts` (9/9 through the RLS role: claim, seat cap, revoke, idempotency,
  entitlement = `team`, RLS isolation). **Remaining config:** `STRIPE_PRICE_FACILITY_MONTHLY/ANNUAL`
  env + a live checkout test (untestable here, same posture as the Org price).
- **Phase 2 — Invoice / PO billing.** `billing_mode = 'invoice'`, admin seat grants, agreement flag.
- **Phase 3 — Opt-in groups + consent (gated on legal review + BAA).** Groups, the consent record,
  group-participation visibility. Do not start until the compliance posture is signed off.
- **Phase 4 — Polish.** Seat reclaim UX, anonymous engagement counts, code lifecycle, receipts.

## Open decisions

- **Facility ↔ Organization overlap.** Facilities are distinct tables, but should a facility be able
  to *also* be an Org (multi-crew)? Default: keep them separate; a facility that wants crews uses the
  Phase 3 group path.
- **Self-serve seat minimum / pricing.** Per-seat price for facilities (vs the $3.99 org seat) and a
  minimum block. Needs a pricing call.
- **Who is the facility admin?** A normal user account linked as admin, or a distinct login? Default:
  a normal user with an admin link (like org owners).

## Acceptance criteria

- A facility can buy seats and generate a code without any client's identity ever appearing.
- Redeeming a code grants full private Pro (`team`) standalone — no crew placement, no visibility.
- The facility console shows only anonymous counts until a client opts into a group.
- Group participation is shared **only** after explicit, revocable consent, and never includes logs,
  bearings, notes, or recovery-mode details.
- Revoking consent (or releasing a seat) stops all disclosure immediately.
- Nothing here touches App Store IAP; facility billing is web-only.
