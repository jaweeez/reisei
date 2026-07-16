# Reisei — Recovery Expansion (scope)

Status: scoping. This deliberately reopens a 1.5 scope guardrail ("do not add more schools
or a tradition-specific fork" in `REISEI_V1_5_PLAN.md`). That was ship-1.5 discipline; this is
the next release. Naming it so it is a choice, not a drift.

## Outcome

Expand the accountability product to people in recovery without diluting the discipline-first
experience the current user has. Two moves:

1. **Group the schools into three families** so The Bearing reads as an intentional map, not a
   flat chip wall: **Philosophy**, **Religion / Spirituality**, **Recovery**.
2. **Add a Recovery family** (new schools + a recovery-tuned generation voice + an opt-in
   "Recovery mode" with a humane, non-streak day count) and make the daily pick **lean harder
   on a fresh log** so what a person is carrying actually steers the day.

Recovery is not a bolt-on. The app already carries recovery DNA: `recovery_plans` (the honest
break), `line_cycles` / `line_reviews`, `reach_out_preference` with `next_meeting` / `one_day`,
and daily states like "an urge or craving pulling at you" and "shame after a slip."

## Decisions locked

- Family label is **Recovery** (not "Recovery & Skills").
- **CBT and ACT move into the Recovery family** (SMART Recovery is built on CBT/REBT, so they
  sit together honestly).
- Recovery schools **count toward the free 2-school limit** like every other school. No special
  gating. (`FREE_SCHOOL_LIMIT` in `src/app/api/bearing/schools+api.ts` is unchanged.)
- **AA and NA are separate schools** (`id: aa`, `id: na`), not one combined 12-Step school, and
  get **fully separate content** — independent anchor prompts and sources per school, not a shared
  Twelve-Step core. Roughly doubles the twelve-step authoring.
- **No near-duplicate reads is a hard requirement**, not a Phase 3 nicety (see "Repeat avoidance"
  and the acceptance criteria).
- **Voice register is user-set at onboarding.** An "address register" preference (how the person
  is spoken to) is captured in onboarding and honored by generated copy. Existing users default to
  today's register, so nothing changes for them. See "Voice register" below.
- Recovery mode is an **independent opt-in** — decoupled from following a Recovery school (see
  "Recovery mode").
- Positioning: keep the exact Reisei voice, but Recovery followers get a **distinct mode** —
  adjusted onboarding and a recovery-tuned tone. Core discipline framing stays for everyone else.

## The taxonomy (final)

Grouping is **static and derived from the school id** — no `user_schools` migration. A new
school is just a new `Ideology` string.

| Family | Schools |
|---|---|
| **Philosophy** | Stoicism, Modern Stoicism, Epicureanism, Existentialism |
| **Religion / Spirituality** | Christianity, Islam, Buddhism, Hinduism, Daoism |
| **Recovery** | CBT, ACT *(moved)* · SMART Recovery, Recovery Dharma, AA, NA, Secular *(new)* |

`mindfulness` stays a coach-only corpus ideology, never a selectable school (see `docs/VOICE.md`).

### Code shape

- `src/data/corpus/types.ts` — extend `Ideology` with `smart-recovery | recovery-dharma |
  aa | na | secular-recovery`; add `IDEOLOGY_LABEL` + `IDEOLOGY_BLURB` entries. Add a
  `SchoolFamily = 'philosophy' | 'spirituality' | 'recovery'` type and a `FAMILY_LABEL` /
  `FAMILY_ORDER` map.
- `src/server/bearing/schools.ts` — add `family: SchoolFamily` to `BearingSchool`; tag every
  school; add the four recovery schools (themes, source link-out, copyright note).
- `src/lib/data/types.ts` — `SchoolView` gains `family`.
- `src/app/api/bearing/schools+api.ts` — `view()` returns `family`.
- `src/app/bearing.tsx` — the picker groups chips under a `Section` / `Eyebrow` header per
  family, in `FAMILY_ORDER`, instead of one flat `styles.chips` row.

## The content model: recovery schools differ from the rest

This is the load-bearing distinction. Learn it from Enso's `src/data/practices.ts`, where every
recovery path is `linkOutOnly: true`.

- **Philosophy / Religion schools** anchor the day on a **verbatim public-domain quote** (Marcus
  Aurelius, the Dhammapada, the WEB Bible) shown in full, with Reisei's own reflection around it.
- **Recovery schools have no public-domain daily text.** AA's Daily Reflections, NA's Just for
  Today, SMART's toolbox, Recovery Dharma / Refuge Recovery (Creative Commons, noncommercial),
  Women for Sobriety, LifeRing — all copyrighted, CC-NC, or otherwise published. We **never
  reproduce their reading text.** Instead:
  - The daily anchor is a **Reisei-authored prompt/principle** (our own words), rotated by
    day-of-year like Enso's `prompts[]`.
  - The card **links out** to the official source ("Open today's Daily Reflection →") and shows
    a `copyrightNote` plus a hard **not-affiliated** line.
  - Corpus grounding for the coach comes from **official descriptive pages** (what the program
    is, its principles), not the copyrighted daily readings.

Architecturally this generalizes the existing engine: today `SCHOOL_QUOTES` scores verbatim
quotes; for recovery schools the same slot holds Reisei-authored prompts. `quoteSims()` /
`chooseQuoteRef()` still work — they score text against the struggle vector regardless of whether
that text is a quote or an own-authored prompt. Rename the mental model from "quote" to "anchor";
keep the code path.

### Copyright posture per recovery school

| School | Source | Status | Reisei shows |
|---|---|---|---|
| SMART Recovery | smartrecovery.org/toolbox | published | own prompts + link-out |
| Recovery Dharma | recoverydharma.org/meditations | CC-NC | own prompts + link-out |
| AA | aa.org/daily-reflections | copyrighted | own wording of well-known principles (one-day-at-a-time, powerlessness, amends, "let go") + link-out + not-affiliated |
| NA | jftna.org (Just for Today) | copyrighted | own wording of NA principles (just for today, clean time, mutual identification, spiritual principles) + link-out + not-affiliated |
| Secular / general | none / our own | n/a | entirely Reisei's framing (HALT, urge-surfing, play-the-tape-forward, honest inventory) |

**AA and NA are separate schools** (`id: aa`, `id: na`), matching Enso, with **fully separate
content**: independent anchor-prompt sets and independent `sources`, not a shared Twelve-Step core.
They share the Twelve-Step frame but differ in substance focus (drinking vs using), link-out (Daily
Reflections vs Just for Today), and daily copy ("stay sober today" vs "stay clean today"). Because
the two still draw on the same tradition, a reader who follows both must not get near-identical
reads on the same day — the cross-school novelty rule under "Repeat avoidance" is what enforces it.

The Serenity Prayer already maps onto the Stoic dichotomy-of-control content the app has; treat
it as a bridge, not a reproduced text.

## More sources per school (the pipeline)

Today `src/data/corpus/teachings.json` has 32 `sources` across 11 schools (Stoicism 5, most
others 2–3). The ask is more per school. The infrastructure already exists — model it on Enso.

- **Pipeline**: `scripts/ingest.ts` → scrape approved `CorpusSource`s with Tavily
  (`src/server/ai/scrape.ts`), chunk (`chunkText`), embed with Voyage (`voyage-context-4`,
  1024-dim), upsert into `teaching_chunks` as `ref_kind='web'`. Curated `teachings` embed as
  `ref_kind='teaching'`. `searchTeachings()` retrieves across both. Enso's `scripts/ingest.ts`
  is the richer reference (crawl-basic / crawl-deep, per-page chunk caps, scrape cache).
- **Refresh cron** already exists: `corpus_source_refreshes` (0022) re-fetches one due source per
  invocation, each due again after 89 days. New sources join it automatically.
- **Work**: raise every school to a target of ~4–6 vetted `sources`, and seed each new recovery
  school with 3–5 official descriptive pages + a handful of curated `teachings`. For copyrighted
  recovery schools, sources must be **descriptive/principle pages, not the daily-reading feeds** —
  we do not want copyrighted devotional text in the vector store shaping output.
- **What source count buys (and does not).** More sources is a *grounding-depth* lever: it widens
  the chunk pool `searchTeachings()` draws from, so the generated tail feels less same-y. It does
  **not** guarantee no-repeat content — that is a separate mechanism (see "Repeat avoidance"
  below). Do not conflate the two.
- **Guardrail**: life-critical numbers (crisis lines) stay hand-verified curated entries, never
  scraped. Mirrors Enso's split.

## Repeat avoidance (what actually prevents repeats)

Two independent layers, neither driven by source count:

1. **Displayed anchor — deduped per reader, bounded by the anchor-set size.** `resolve.ts` keeps a
   per-reader "already shown" ledger (`readUsedQuoteRefs`) and `selectUnusedQuoteRef` (`select.ts`)
   runs unconditionally — even on a quiet day. If today's rotation anchor was already shown, the
   day is promoted to a generated bearing built around an unused anchor, so a reader never sees the
   same anchor twice **until the curated set is exhausted** (bound = `SCHOOL_QUOTES` size per
   school, ~3–6, not source count). After exhaustion the anchor is `null` and the read is generated
   source-grounded with no quote.
2. **Generated principle + technique — NOT deduped today (the gap).** No content-level hash or
   embedding novelty check exists in `store.ts` / `resolve.ts`. Variety comes only from LLM
   temperature (0.7) and the `theme × state` rotation, which cycles on a fixed period, retrieves
   the same top chunks for a repeating `(theme, state)` query, and can drift toward sameness over a
   long horizon. This hits **recovery schools hardest**: their anchors are Reisei-authored prompts
   (no public-domain quote), so the small authored set exhausts fast and the indefinite tail is all
   generation.

**Fix — HARD REQUIREMENT (not optional).** Extend the ledger from anchors to generated text: store
an embedding (or shingle hash) of each shown principle per user, and at generation reject or re-roll
a candidate too similar to the reader's recent reads (rotate the grounding chunk, shift the state,
or bump temperature) within a rolling ~30–60 day window. Source depth only reduces the odds; this is
the lever that actually guarantees it. Suggested default: cosine-similarity floor ~0.9 over the last
45 shown reads, with a bounded re-roll count before falling back to the least-similar candidate.

**Cross-school, not per-school (the AA/NA split forces this).** The novelty check must run across
*all* of a reader's followed schools for the day, not per school. AA and NA share the Twelve-Step
frame, so a reader who follows both would otherwise get two near-identical reads on the same day.
Dedup the day's *set* of reads against each other and against the rolling history.

## Recovery-tuned generation (different voice for a different user base)

The current `BEARING_SYSTEM` (`src/server/bearing/compose.ts`) writes for "a man taking a quote
into his body" — composure, discipline, willpower-adjacent. Recovery needs a different register.
Add a `RECOVERY_BEARING_SYSTEM` variant, selected when the school's `family === 'recovery'`:

- Non-punitive and relapse-aware. Never willpower-shame. A slip is "begin again," not failure.
- Treats cravings/urges as **passing states to ride out** (urge-surfing), not enemies to crush.
- Leans on recovery-native moves: HALT check (hungry / angry / lonely / tired), one-day-at-a-time,
  reach out before it gets loud, play the tape forward.
- No verbatim third-party text (there is no public-domain anchor to quote); the model states the
  school's approach in Reisei's own words and links out.
- The safety off-ramp is the recovery one (SAMHSA + 988), not just the general crisis line.

Add recovery-native felt-states to `DAILY_STATES` so the retrieval query and state-match speak
the right language: "craving that keeps circling back", "white-knuckling it", "a slip you're
sitting in", "isolating, want to disappear", "romanticizing using". `stateForToday` and
`bestState()` pick these up with no other change.

## Voice register (user-set at onboarding)

The app is male-coded throughout (`docs/VOICE.md`). The recovery audience is broader, so **how a
person is addressed becomes a stored preference**, not a global constant.

- **Model**: an `address_register` on the user (values TBD, e.g. `default` / `neutral`; leave room
  to grow). Captured in onboarding. **Existing users default to `default`** — their experience is
  untouched, and this is not a migration of shipped copy.
- **Where it applies cheaply (do this)**: generated copy. Pass the register into `BEARING_SYSTEM` /
  `RECOVERY_BEARING_SYSTEM` and the coach system prompt as a variable ("address the reader in a
  {register} register"). The model already writes fresh each call, so this is a prompt parameter,
  not a copy fork.
- **Where it is expensive (scope boundary)**: hand-written static strings. Converting every shipped
  string to register variants is a large, separate effort. For this release, honor the register in
  **generated** copy and in the **new** recovery-onboarding strings only; leave the existing static
  UI copy as-is. Note this limit explicitly so it is a choice, not a surprise.
- **Guardrail unchanged**: register changes tone of address, never the substance or the safety
  rules. `docs/VOICE.md` bans (clinical jargon, cliches, em dashes, emoji) still apply in every
  register.

## Deeper personalization — steer harder on a fresh log

How it works today (`src/server/profile/profile.ts`, `bearing/resolve.ts`, `select.ts`,
`vectors.ts`): every non-dark log entry is embedded and folded into a long-run centroid; a
`struggleVector()` returns `{ vec, strength }` — fresh entries (< `FRESH_DAYS` 3) push strength
up to `MAX_STRENGTH` 0.85, fading to 0 by `FADE_DAYS` 21, else the centroid at `BASELINE_STRENGTH`
0.3. `resolveUserBearing()` lets that signal move (a) which curated anchor is chosen
(`chooseQuoteRef`) and (b) the felt-state (`bestState`, gated at `STATE_FLOOR` 0.45). If either
differs from the date rotation, it generates a personalized bearing; else it copies the shared
neutral one.

The gap: the signal only re-selects from **fixed sets** (curated quotes, 12 canned states). The
generation prompt itself is grounded by `searchTeachings(theme + state, ideology)` — canned
words, not the live struggle. Four concrete upgrades:

1. **Retrieve grounding by the struggle vector, not canned words.** Add an optional
   `queryVec?: number[]` to `searchTeachings()` and pass the struggle vec (or a blend of it with
   the theme+state text embedding) from `generateBearing()`. The teachings that ground the read
   then actually match what is live, not a rotation keyword. Highest leverage, low risk.
2. **Widen and sharpen the state vocabulary** (see recovery states above) so a fresh log maps to
   a state that fits — the coarse 12-state list is the current ceiling on specificity.
3. **Recovery-mode freshness dial.** In recovery, a fresh craving/slip log should move the day
   more. Allow per-family tuning: recovery raises `MAX_STRENGTH` and lowers `STATE_FLOOR` so a
   fresh entry pulls harder. Keep the discipline default unchanged.
4. **(Optional) Signal-aware lead ordering.** When a user follows multiple schools, order today's
   cards by which school's corpus best matches the live struggle, so the most relevant school
   leads. Additive; no data change.

Non-negotiable constraint carried through: **match, don't mention.** The generated read lands on
what is up but never references that anything was written (enforced in the system prompt today;
keep it in the recovery variant). See the memory note "Log + ambient Bearing."

## Recovery mode (opt-in; humane by design)

Model it on Enso's recovery tracker (`ens-/db/migrations/0023_recovery_tracker.sql` +
`recovery-tracker+api.ts`), adapted to Reisei's Line/Cycle world. Opt-in, owner-private, never in
the Crew consent graph.

**Independent of school choice.** Recovery mode is decoupled from following a Recovery school. A
person can follow AA for the daily principle without turning on sober-date tracking, and can turn
on Recovery mode without picking a specific school. The not-treatment acknowledgment (see "Duty of
care") fires on **whichever comes first** — picking a first Recovery school *or* enabling Recovery
mode — and is shown once. The recovery-tuned generation voice keys off the followed school's
`family === 'recovery'`, not off Recovery mode.

- **Two modes, borrowed from Enso**: `chapter` (count days from a start date) or `practice` (no
  count). A `show_count` toggle can hide the number. This is how a day count coexists with
  Reisei's "integrity, not a perfect streak" principle — the number is optional and never a
  Crew-visible score.
- **"Begin again" starts a new chapter, not a shame reset.** Prior chapters are preserved. A
  relapse routes through the **existing honest-break flow** (RESPECT ack → `recovery_plans` → one
  concrete move), never a punitive zeroing. "One day at a time" is the literal framing.
- **Daily response stays held/slipped** (decided). We do *not* adopt Enso's softer
  `with_intention / difficult / begin_again` set — recovery-mode days use the same held/slipped
  action as the rest of the app, feeding the same Cycle. The humane handling lives in *how a
  slip is treated* (chapters, honest-break flow), not in renaming the action.
- **Intake** (optional, private): what you're recovering from (free/optional), a sober/clean date,
  sponsor/home-group yes-no, reach-out preference (already exists).
- **New migration**: `recovery_profiles` (opt-in flag, mode, started_on, show_count, what-from,
  sponsor flag) + `recovery_chapters`. RLS owner-only, `force row level security`, mirroring
  Enso.
- **Later**: sponsor as a Crew role with stronger quiet-day / relapse reach-out; a meeting finder
  link-out (`next_meeting` reach-out already exists).

## Duty of care (required, not optional)

Recovery raises the stakes past "a hard day": relapse, withdrawal, overdose.

1. **A one-time acknowledgment** when a user picks a Recovery school or enters Recovery mode:
   *"Reisei is not treatment, a sponsor, or a meeting."* Mirrors the honesty-agreement pattern in
   `REISEI_V1_5_PLAN.md`.
2. **Recovery resources in the off-ramp**: SAMHSA National Helpline (1-800-662-HELP) + 988,
   surfaced in the Log / Bearing when recovery language or a break appears.
3. **Expand `src/server/profile/safety.ts`** — `CRISIS_PATTERNS` and the classifier context cover
   only suicide/self-harm today. Add relapse/overdose/using-with-intent language, and keep the
   existing behavior that a `dark` entry is saved but kept out of the profile and shown the
   off-ramp instead of being coached.

## Work by layer

1. **Taxonomy (no migration)** — families + tags + five recovery school defs (SMART, Recovery
   Dharma, AA, NA, Secular) + sectioned picker.
2. **Content** — recovery anchor prompts + copyright notes in `schools.ts`; recovery-native
   `DAILY_STATES`; expand `teachings.json` sources toward 4–6 per school; ingest run.
3. **Generation** — `RECOVERY_BEARING_SYSTEM`; recovery off-ramp; family-aware selection in
   `generate.ts`.
4. **Personalization** — `searchTeachings(queryVec)`; per-family freshness dial; **cross-school
   generated-read novelty check (hard requirement)**; optional lead ordering.
5. **Recovery mode (migration)** — `recovery_profiles` + `recovery_chapters`; intake screen;
   the not-treatment ack; relapse → honest-break wiring.
6. **Safety** — pattern + resource work in `safety.ts` and the off-ramp component.

## Phasing

- **Phase 1 — Families + picker.** Group the existing 11 into three families, sectioned UI. Ships
  value with zero recovery-content risk. (~4–6h)
- **Phase 2a — Recovery schools live, safely. [DONE]** Five recovery schools (SMART Recovery,
  Recovery Dharma, AA, NA, Secular) in the taxonomy + picker; recovery-voiced generation
  (`RECOVERY_BEARING_SYSTEM`, family-branched in `generate.ts`); 20 curated recovery teachings
  grounding it (Reisei's own words, no verbatim program text; `quote` is always null for recovery);
  recovery-native `DAILY_STATES`; duty of care — not-treatment `InlineNotice` in the picker Recovery
  section, `CrisisCard` SAMHSA variant, expanded `safety.ts` relapse/overdose patterns (ordinary
  cravings/slips stay `ok`). tsc + 49 tests + web export green.
- **Phase 2b — DONE.** `address_register` end-to-end (migration 0025, `registerDirective` in
  `voice.ts`, threaded through `generate.ts` + `resolve.ts`, `/api/profile` GET/POST) with a
  **Standard/Neutral control in Settings > Profile**. **Source expansion + ingest run**: every school
  now has 4-6 `sources`; `npm run ingest` rebuilt the corpus (62 curated + 402 web chunks; all 5
  recovery schools grounded in vector mode, copyright-safe descriptive pages only). **One-tap ack
  modal**: the picker shows the not-treatment acknowledgment the first time a Recovery school is
  followed (`recoveryAck` exposed on `/api/bearing`, recorded via `/api/accountability`). **Log
  off-ramp**: `CrisisCard recovery` (SAMHSA) now shows for recovery followers via a `followsRecovery`
  flag on the journal feed.
- **Phase 3 — Deeper personalization. [DONE]** `searchTeachings(queryVec)` biases grounding to the
  live struggle; per-family freshness dial (recovery lowers the state floor + boosts strength);
  recovery state vocabulary (shipped in 2a); and the **cross-school no-repeat novelty check (hard
  requirement)** — `novelty.ts` (pure, unit-tested) + `principle_vec` on `user_bearings` (migration
  0024) + a re-roll loop in `resolve.ts`, with the `bearing+api` resolution made sequential so
  same-day reads dedup against each other. tsc + tests + export green. (Full effect needs Voyage +
  DB; pure logic is unit-tested, DB path verified by build.)
- **Phase 4 — Recovery mode. [DONE, UI unverified on device]** Migration 0026
  (`recovery_profiles` + `recovery_chapters`); pure sober-time/chapter math (`server/recovery/mode.ts`,
  unit-tested); `/api/recovery-mode` (setup / preferences / begin_again / disable), which records the
  not-treatment ack on enable; a `recovery-mode.tsx` screen (intake, sober-time display with an
  optional `show_count`, "Begin again" = new chapter not a shame reset) linked from Settings.
  Opt-in and independent of following a Recovery school. Server + build verified; the screen needs a
  device pass.
- **Phase 5 — DONE (sponsor + meeting finder).** Sponsor is a **private, off-Crew contact** (name +
  how to reach them) on `recovery_profiles` (migration 0027), set on the recovery-mode screen and
  never shared with the Crew. Meeting finder is a link-out list (AA / NA / SMART finders +
  findtreatment.gov) on the recovery-mode screen.

## Resolved

- **Anchor mechanism** — reuse the `SCHOOL_QUOTES` slot with own-authored prompts (renamed "anchor"
  in comments). No separate `SCHOOL_PROMPTS` map.
- **Recovery daily response** — keep held/slipped; do not adopt Enso's softer set.
- **`address_register`** — chooser lives in **general onboarding**; values `default` / `neutral`
  to start; honored by generated copy only this release (static shipped strings unchanged).

## Open decisions (recommended defaults)

- **Lead ordering (personalization #4)** — ship in Phase 3 or defer. *Default: defer; it's
  additive polish.*
- **`address_register` growth** — whether to add registers beyond `default` / `neutral` later.
  *Default: ship the two, leave the column open to more.*

## Monetization

Recovery fits the existing Free / Pro / Crew model; no new tier. Decisions:

- **Safety is always free (non-negotiable).** The off-ramp, 988, SAMHSA helpline, the not-treatment
  ack, and the meeting finder are never paywalled. Verified free today.
- **Recovery mode is free** (sober-time count, chapters, begin-again, sponsor, meeting finder) — an
  acquisition hook for the recovery audience; paywalling a sobriety counter reads as predatory.
- **Recovery schools count toward the free 2-school limit; Pro is unlimited** (unchanged). A recovery
  user wanting AA + NA + a philosophy tradition hits the cap at 2 — a natural Pro conversion point.
- **Personalization is a Pro benefit (gated in `resolve.ts`, DONE).** The paywall advertised
  "personalized Bearings" as Pro but the code gave the struggle-steered read, the freshness dial, and
  the no-repeat novelty to everyone. Now free users get the neutral, shared, date-rotated Bearing;
  Pro gets the tailored + non-repeating read. Also cheaper to serve free users (no per-user
  generation, embeddings, or re-rolls).
- **Voice register is NOT paid.** A non-default register is still honored for free users via a
  per-user generation (it is an inclusivity setting, not a feature to gate); default-register free
  users copy the cheap shared bearing.
- **Paywall copy** updated to surface unlimited traditions (incl. recovery) and log-tailored Bearings.

## DB verification

The DB-path logic (previously build-only) is now exercised against a live Postgres through the
restricted `reisei_app` RLS role by `scripts/verify-recovery-mode.ts` (`npm run db:verify-recovery`).
It creates throwaway users, runs the exact API/resolver SQL, and self-cleans. **16/16 assertions
pass**: recovery-mode setup, the `begin_again` chapter transition (prior chapter closed yesterday,
new chapter today, start date moved, day count via `mode.ts`), preferences, the private sponsor
round-trip, the not-treatment ack persistence, `followsRecovery` + the bearing `recoveryAck` reads,
`principle_vec` round-trip + the no-repeat recent-window ordering, RLS isolation (a second user sees
none of the first's recovery/bearing rows), and disable (profile removed, chapter history preserved).
Migrations 0024–0027 are applied on the dev DB and the corpus is ingested. Still device-only-pending:
the RN screens' visual pass.

## Acceptance criteria

- The Bearing picker shows three labeled families; no flat chip wall.
- No recovery school ever displays third-party reading text; each links out with a copyright note
  and a not-affiliated line.
- A recovery-mode relapse never zeroes a Crew-visible score; it starts a new chapter and runs the
  honest-break flow.
- A fresh, live log demonstrably changes the grounding teachings the read is built from (not just
  the anchor choice).
- Picking a Recovery school shows the not-treatment acknowledgment once, and the off-ramp carries
  SAMHSA + 988.
- The discipline-first experience for a non-recovery user is unchanged.
- **No reader is shown a near-duplicate generated read within the rolling novelty window, across
  all of their followed schools (not just per school).** A reader following AA and NA never gets
  two near-identical reads on the same day. This is verified, not assumed. *(hard requirement)*
- AA and NA are independently selectable schools with distinct link-outs and daily copy.
