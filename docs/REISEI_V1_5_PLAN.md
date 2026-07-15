# Reisei 1.5: The Integrity Release

## Release outcome

Reisei 1.5 should feel like one intentional accountability system, not a collection of cards and tools.

The product loop is:

1. Draw a Line.
2. Tell the truth each day.
3. Let your Crew see whether you showed up.
4. Recover quickly when you miss.
5. Review the Line every 14 days and decide what comes next.

Every screen, feature, and paid benefit in 1.5 must support that loop.

## Product decisions

### Naming

- Rename all customer-facing uses of **Corner** to **Crew**.
- Keep **Line** as the commitment. A Line can be something the member will not cross or a bar the member will hold.
- Use **Cycle** for each 14-day commitment period.
- Keep **The Ledger**, **The Bearing**, **Reset**, and **The Log**.
- Internal `crew` database and API names can remain unchanged.

### Pricing model

#### Free

- One active Line
- Daily honest check-in
- Basic streak and current Cycle status
- Join a Crew when another plan covers the member
- Basic Reset and recovery flow

#### Pro: $12.99 per month or $99 per year

- Full Pro for the subscriber and two invited people, three people total
- One private Crew
- 14-day Line Reviews and saved Cycle Reports
- Weekly Crew Review
- Personal Reach-Out Agreement
- Full Ledger and Line history
- Full private Log history
- Personalized Bearings and unlimited schools
- Recovery planning
- No ads and no sale of personal data

#### Crew

- Flat price for up to eight people
- Working price: $24.99 per month or $199 per year
- Everything in Pro
- A larger small-group roster
- Captain controls, Crew health summary, and member placement

#### Organization

- Multiple Crews under one owner
- Organization-level roster, placement, billing, and high-level participation reporting
- No access to private Logs, private Bearing responses, or personal notes
- Keep the current Organization code compatible, but do not expand Organization features in 1.5. Validate Crew retention first.

### Billing rule

A covered person gets the complete Pro experience. Do not create a confusing split where the leader can use group features but invited members must discover that they need another subscription.

## The honesty agreement

This should be treated as a product agreement, not a legal disclaimer hidden in Settings.

### Primary copy

> Reisei only works if you tell the truth. If you lie to yourself or your Crew, you are wasting your time and theirs. Report the miss. The point is integrity, not a perfect streak.

### Short reminder

> Tell the truth. That is the work.

### Placement

- Show the full agreement when a member draws the first Line.
- Show it again before a member creates or joins a Crew.
- Require a one-time acknowledgement: **I will report honestly.**
- Show the short reminder beside the daily Held it and It slipped actions.
- Do not repeatedly interrupt returning members with a modal.

### Privacy promise beside the agreement

Members must know exactly what honesty exposes:

> Your Crew sees your Line and whether you held it, broke it, or did not check in. Your Log, notes, Bearings, and recovery details stay private.

## 14-day Line Cycle

Fourteen days is the review cadence, not a claim that a habit is formed in fourteen days.

### Starting a Cycle

When a member draws a Line, show:

- The exact commitment
- The start date
- The first review date
- What the Crew can see
- The honesty agreement

### During the Cycle

- Show `DAY 06 OF 14` near the Line.
- Keep the daily action focused on Held it or It slipped.
- Preserve the existing recovery plan after a break.
- Do not punish an honest break beyond resetting the hold streak.

### Changing early

Do not hard-lock the Line. Allow an early change, but require one reason:

- The Line was unclear
- The Line was unrealistic
- Circumstances changed
- The Line is no longer safe or appropriate
- Another reason

Close the Cycle as `changed early`, preserve its record, and start a new Cycle. The Crew can see that the Line changed, but not the private reason.

### Day 14 Line Review

Prompt the member to choose one action:

- **Keep it**: run the same Line for another Cycle.
- **Refine it**: make the Line clearer or more realistic.
- **Raise it**: choose a more demanding version.
- **Replace it**: start a different Line.
- **Retire it**: close the Line without drawing another yet.

Ask three short questions:

1. What made this Line easier to hold?
2. What usually got in the way?
3. What is the next honest standard?

### Cycle Report

Save a compact report in The Ledger:

- Cycle dates and final status
- Held, broke, and quiet days
- Hold rate
- Longest run
- Recovery rate and typical recovery time
- Hardest day of the week, when enough data exists
- The member's private review answers

The Crew sees only the member's public outcome summary. Private answers remain private.

## Weekly Crew Review

The Crew needs a reason to return together beyond daily dots.

Once a week, show one compact Crew Review:

- Who checked in consistently
- Honest breaks
- Quiet days that may need a reach-out
- Recoveries after a break
- Each member's next stated Line or continued Line

The review must not rank members. Reisei is a witness system, not a leaderboard.

Suggested public language:

> This week is not a score. It is a read on who showed up, who told the truth, and who may need a call.

## Personal Reach-Out Agreement

Each member chooses what the Crew should do after a quiet day:

- Send a Reisei nudge
- Text me
- Call me
- Ask me directly at the next meeting
- Give me one day, then reach out

The first version stores and displays the preference. It does not need SMS or calling integration. A Crew member can tap the preference and use the device share or contact flow later.

## Cohesive UI system

### Why the current UI feels jumbled

The visual tokens are sound, but nearly every piece of content is presented as an equal Card. The Today screen mixes nudges, Bearings, the Line, recovery, Reset, account notices, and Crew summaries at the same visual weight. Settings also turns every destination into a separate card. The result has rhythm, but not hierarchy.

### Screen hierarchy rules

Every screen gets no more than:

- One page title
- One hero element
- One primary action
- Two supporting sections before secondary tools

Use brass only for the primary action and meaningful emphasis. Use bubble green only for presence, held status, and recovery. Do not use a Card simply to create spacing.

### Component set

Build and use these shared patterns:

- `PageHeader`: title, optional cycle/date context, one trailing action
- `HeroPanel`: the one dominant object on a screen
- `Section`: label and grouped content without a full floating card
- `ListRow`: consistent member, setting, or history row
- `StatusPill`: held, broke, quiet, or review due
- `InlineNotice`: account, recovery, or billing notice
- `ActionDock`: stable primary action area for daily check-in and reviews
- `EmptyState`: one explanation and one next action

Reserve `Card` for a complete object that deserves a boundary, such as the active Line, one Crew, or one Cycle Report.

### Navigation

Keep four tabs:

1. **Today**
2. **Crew**
3. **Log**
4. **You**

The Bearing, Reset, Ledger, billing, and account controls are destinations, not additional tabs.

### Today

Order the screen around the daily job:

1. Page header with date and Cycle day
2. Active Line hero
3. Held it and It slipped action dock
4. Contextual recovery, only when needed
5. Compact Crew pulse
6. Compact tools row for Bearing, Reset, and Log

Do not place a full Bearing card above the active Line. The Line is the product's primary object.

### Crew

Order the screen around people:

1. Crew name and weekly status
2. Member rows with posture, Line, and one relevant response
3. Quiet member reach-out prompt
4. Weekly Crew Review
5. Invite and management actions

Move seat and billing management behind a `Manage Crew` destination. It should not compete with the daily accountability view.

### Log

- Keep writing as the hero action.
- Use a flat dated list for prior entries instead of one large card per entry.
- Keep crisis support visible but visually calm unless the safety screen raises it.

### You

Group settings into compact sections:

- Profile
- Plan and billing
- Coach and reminders
- Privacy and safety
- Account actions

The Bearing and Ledger should be reachable from Today and their relevant summaries, not promoted as unrelated cards in Settings.

## Required data and API work

### Database

- Add `line_cycles` for start date, review date, end date, outcome, and early-change state.
- Add `line_reviews` for private answers and the chosen next action.
- Add `crew_member_agreements` for honesty acknowledgement and reach-out preference.
- Add weekly Crew summary support. Generate summaries from existing check-ins rather than storing duplicate totals unless performance requires it.
- Preserve existing `lines`, check-ins, acknowledgements, recovery plans, and Ledger history.

### API

- Return current Cycle state with the Today payload.
- Add start, early-change, and review actions for a Cycle.
- Add Cycle Reports to The Ledger.
- Add honesty acknowledgement and reach-out preference endpoints.
- Add weekly Crew Review data without exposing private notes.
- Enforce the three-person Pro coverage rule and eight-person Crew cap server-side.

### Billing and entitlement

- Replace the current `pay to lead plus optional seats` explanation with covered-member limits.
- Map Pro to three covered accounts total.
- Map Crew to eight covered accounts total.
- Migrate existing paid customers without removing access during the transition.
- Update Stripe, RevenueCat, paywall copy, settings labels, restore flow, and webhook tests together.

## Implementation order

### Phase 1: Product contract and UI foundation

- [x] Freeze the customer-facing names: Crew, Line, Cycle, Ledger, Bearing, Reset, Log.
- [x] Add the shared UI components and screen hierarchy rules.
- [x] Replace one-off close controls, headings, notices, and list rows.
- [ ] Add screenshot fixtures for free, Pro, Crew captain, and covered member states.

Exit condition: the component system can express every core screen without inventing another card style.

### Phase 2: Today and Crew redesign

- [x] Make the active Line the Today hero.
- [x] Move Bearing, Reset, and Log into a compact supporting tools row.
- [x] Add a stable daily action dock.
- [x] Rebuild Crew around member rows and relevant responses.
- [x] Move seats and billing behind Manage Crew.
- [x] Rename visible Corner copy to Crew.

Exit condition: a new user can identify today's one job within five seconds on both Today and Crew.

### Phase 3: Integrity Cycle

- [x] Add Cycle migrations and API behavior.
- [x] Add the honesty agreement.
- [x] Show Cycle day and review date.
- [x] Add early-change reasons without a hard lock.
- [x] Add the Day 14 Line Review.
- [x] Save Cycle Reports to The Ledger.

Exit condition: a member can start, complete, continue, refine, replace, or end a Cycle without losing history.

### Phase 4: Three-person Pro accountability

- [x] Add covered-member invitations for Pro.
- [x] Give all three people full Pro access.
- [x] Add the Personal Reach-Out Agreement.
- [x] Add the Weekly Crew Review.
- [x] Update Crew privacy explanations.

Exit condition: three people can understand who pays, who is covered, what each person sees, and what happens when someone goes quiet.

### Phase 5: Billing migration and release hardening

- [ ] Create the new Pro products and offerings in Stripe and the mobile stores.
- [ ] Update RevenueCat mappings and webhook tests.
- [x] Update the paywall to $12.99 monthly and $99 annual.
- [ ] Add Crew pricing only after the three-person flow passes end-to-end testing.
- [ ] Preserve access for existing subscribers through a documented migration rule.
- [ ] Test purchase, invite, removal, cancellation, restore, lapse, and renewal.
- [ ] Run accessibility, small-screen, tablet-rotation, and web-width checks.
- [ ] Replace store screenshots and product copy with the cohesive 1.5 UI.

Exit condition: billing state and covered-member access agree across Stripe, RevenueCat, the API, and the UI.

## Scope guardrails

Do not add these to 1.5:

- More AI chat
- More schools or a larger content library
- Public profiles
- Leaderboards, points, or competitive rankings
- SMS or phone-call automation
- New Organization dashboards
- Complex captain analytics
- A Christian-only edition or other tradition-specific fork

The release succeeds if the existing value becomes obvious and the accountability loop becomes complete.

## Acceptance criteria

- No customer-facing screen says Corner.
- Today has one obvious primary object and one obvious primary action.
- A first-time user sees and accepts the honesty agreement before the first Line or Crew participation.
- Crew members can clearly tell what is shared and what stays private.
- A member can review or change a Line without losing the prior Cycle.
- A Pro subscriber can cover exactly two invited people, and all three receive the same Pro features.
- The app never claims a habit is built in 14 days.
- The Weekly Crew Review does not expose private notes or rank people.
- Existing paid users retain access during billing migration.
- Core flows pass on iOS, Android, and web.

## Success measures

Measure only what can guide the next release:

- Percentage of new users who draw a Line
- Percentage who complete the first daily check-in
- Day 7 and Day 14 return rate
- Percentage who complete a Day 14 Line Review
- Percentage of Pro subscribers who invite at least one person
- Percentage of three-person Crews with at least two active members each week
- Recovery rate within two days of a break
- Quiet-day reach-outs sent
- Trial to paid conversion and annual plan share

## Solo-founder delivery estimate

Plan for roughly 60 to 80 focused hours:

- UI foundation and core-screen redesign: 24 to 30 hours
- Cycle data, APIs, review, and Ledger work: 18 to 24 hours
- Three-person entitlements and Crew features: 10 to 14 hours
- Billing migration, QA, and store assets: 8 to 12 hours

At part-time founder pace, this is a four to six week release. If time slips, cut Weekly Crew Review polish and Crew plan sales first. Do not cut the Today hierarchy, honesty agreement, Cycle history, privacy boundary, or covered-member billing clarity.
