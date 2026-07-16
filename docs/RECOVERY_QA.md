# Recovery expansion — manual QA checklist (device pass)

The server, DB, and build layers are verified. These are the RN screens that need a human on a
real device / the running app. Test as a fresh-ish user where noted.

## The Bearing picker (`/bearing`)
- [ ] The picker shows three labeled sections: **Philosophy**, **Religion & Spirituality**, **Recovery**.
- [ ] CBT and ACT appear under **Recovery** (not their own group).
- [ ] Tapping a Recovery school for the first time shows the **"Before you start"** card
      (not treatment / a sponsor / a meeting; 988 + SAMHSA). Options: **I understand** / **Not now**.
- [ ] **Not now** cancels (school not followed). **I understand** records the ack and follows the school.
- [ ] After acknowledging once, following another Recovery school does **not** show the card again.
- [ ] A recovery Bearing card shows: no quoted epigraph, a principle + a "Try:" line, an
      **Open the source →** link that opens the official site, and a not-affiliated/not-treatment caption.
- [ ] Free plan still caps at 2 followed schools (recovery schools count toward it).

## Recovery mode (`Settings > Privacy and safety > Recovery mode`)
- [ ] Intake shows: **Count the days** / **Just practice** toggle, a start-date field (chapter only),
      an optional "what you're recovering from", and an "I have a sponsor" chip.
- [ ] Enabling in **chapter** mode with a past date shows the correct **day count** and any milestone.
- [ ] The **show-count** preference hides/shows the number.
- [ ] **Begin again** starts a new chapter (count resets, prior chapters preserved, no shame framing).
- [ ] **Practice** mode shows no count.
- [ ] Sponsor **name + contact** save and persist (private; confirm it never appears in Crew views).
- [ ] Meeting-finder links open (AA / NA / SMART / findtreatment.gov).
- [ ] **Turn off Recovery mode** removes the profile; re-enabling still shows past chapters.

## Voice register (`Settings > Profile`)
- [ ] **Standard / Neutral** chips reflect and change the saved register.
- [ ] With **Neutral**, a freshly generated Bearing read is not male-coded (spot check the wording).

## Log off-ramp (`Log` tab)
- [ ] For a user following a Recovery school, the standing CrisisCard includes the **SAMHSA** line
      (1-800-662-4357) in addition to 988.
- [ ] Writing an entry with clear crisis language surfaces the alert off-ramp with the recovery resources.
- [ ] An ordinary craving / honest-slip entry does **not** trip the off-ramp.

## No-repeat (spot check, needs a few days of data)
- [ ] Following both AA and NA, the two daily reads are not near-identical on the same day.
- [ ] Reads don't obviously repeat day over day for a followed school.

## Regression (existing users unaffected)
- [ ] A non-recovery user's Bearing, Log, and check-in flows look and behave exactly as before.
- [ ] Existing users default to the **Standard** register.
