# Reisei — Google Play submission package

Prepared July 10, 2026 from the current Reisei app and Google Play requirements.

## Main store listing

| Field | Value |
| --- | --- |
| App name | Reisei |
| Default language | English (United States) |
| App or game | App |
| Free or paid | Free (contains in-app subscriptions) |
| Category | Health & Fitness |
| Suggested tags | Personal growth, Meditation, Habit tracker (choose the closest tags Play Console offers) |
| Package name | `com.muworks.reisei` |
| Current app version | `0.1.0` |
| Developer | Mu Works LLC |
| Support email | `support@reiseiapp.com` |
| Website | `https://www.reiseiapp.com` |
| Privacy policy | `https://www.reiseiapp.com/privacy` |

### Short description — 80/80 characters

> Daily check-ins, private reflection, and a small crew that helps you stay level.

### Full description — 1,130/4,000 characters

> Stay level when the day gets loud.
>
> Reisei is a daily composure-training practice built around one honest check-in. Set your line, say how the day actually went, and build a streak based on showing up—not performing.
>
> WHAT YOU CAN DO
> • Draw your line for the day
> • Check in as held, slipped, or not yet
> • Keep a private log for honest reflection
> • Get a daily Bearing from a tradition you choose
> • Use a 60-second Reset when stress spikes
> • Build a small Corner that helps you stay accountable
> • Review your history in the Ledger
>
> PRIVATE BY DESIGN
> Your Log stays private. Your Corner sees only the line you chose to share and your daily posture. Reisei does not sell your data or use it for advertising.
>
> REISEI PRO
> Pro unlocks Corner leadership, full history, an extended log archive, and multiple schools for your daily Bearing. Subscriptions are optional and can be managed through Google Play.
>
> Reisei is for adults. It is a composure-training and wellness tool—not therapy, medical care, or a crisis service. If you are in distress, contact a qualified professional or crisis service. In the United States, call or text 988.

## Graphic assets

| Asset | File | Requirement/status |
| --- | --- | --- |
| Store icon | `app-icon-512.png` | 512×512 PNG; ready |
| Feature graphic | `feature-graphic-1024x500.jpg` | 1024×500 JPEG with no alpha; ready |
| Phone screenshots | `screenshots/01-today.jpg` through `06-pro.jpg` | 1080×1920 JPEG; ready |

Recommended screenshot order:

1. `01-today.jpg` — daily Line and check-in
2. `04-bearing.jpg` — personalized daily Bearing
3. `02-corner.jpg` — small-group accountability
4. `03-log.jpg` — private reflection Log
5. `05-reset.jpg` — guided 60-second Reset
6. `06-pro.jpg` — optional Pro membership

Screenshot alt text:

1. “Daily Line check-in with streak, reflection prompt, and held or slipped choices.”
2. “Daily Stoic Bearing with a sourced passage and personalized reflection.”
3. “Private Review Corner showing the member’s daily posture and accountability.”
4. “Private Log entry screen with a reflection prompt and crisis support resources.”
5. “Guided box-breathing Reset showing round one and a breathe-in cue.”
6. “Reisei Pro membership screen with monthly and annual options.”

## App access for Google review

Select **All or some functionality is restricted** and provide:

> Reisei requires a username and PIN. No email verification or one-time code is required for this review account.
>
> Username: `google.demo`
> PIN: `582941`
>
> The account has Pro access and a preconfigured Review Corner. After login, the Today, Corner, Log, Bearing, Reset, Ledger, and Settings features are available. To see the Bearing, open Today and tap “Today's bearing.”

## App content declarations

| Declaration | Recommended answer |
| --- | --- |
| Ads | No, the app does not contain ads |
| Target audience | Adults, 18 and over |
| Restrict minor access | Recommended: Yes |
| News app | No |
| Government app | No |
| Financial features | No (ordinary in-app subscriptions are not a financial-services feature) |
| Health apps | Yes — **Stress Management, Relaxation, Mental Acuity** |
| Medical device | No |
| Medical/health disclaimer | Reisei is a wellness and composure-training tool, not therapy, medical care, diagnosis, treatment, or a crisis service |
| Content rating | App; no violence, sexual content, gambling, controlled substances, or profanity supplied by the developer; users can share limited user-generated content and interact inside invite-only Corners; crisis resources are referenced without graphic content |
| Sensitive permissions | Only `POST_NOTIFICATIONS`; no location, camera, microphone, contacts, photos, SMS, or call-log permission |

The privacy policy currently says the app is not for users “under 17.” Change this to “under 18” before submission so it matches the recommended 18+ target-audience declaration.

## Data safety answers

General answers:

- The app collects user data: **Yes**.
- The app shares some data: **Yes**, conservatively declared because a user’s chosen Line, display identity, and daily posture are visible to members of an invite-only Corner. Private Log text is not shown to Corner members.
- Data is encrypted in transit: **Yes**.
- Users can request deletion: **Yes, in the app**. A separate public web deletion pathway is still required; see Blockers below.
- Data is sold: **No**.
- Data is used for advertising: **No**.

| Google Play data type | Collected | Shared | Optional | Main purposes |
| --- | --- | --- | --- | --- |
| Personal info — name | Yes | Yes, within a joined Corner | No | Account management, app functionality |
| Personal info — email address | Yes | No, except service providers | Yes | Account recovery, developer communications |
| Personal info — user IDs | Yes | Yes, within a joined Corner | No | Account management, app functionality |
| Health and fitness — health info | Yes | Yes, limited posture/Line within a joined Corner | No | App functionality, personalization |
| App activity — app interactions | Yes | No, except service providers | No | App functionality, analytics/personalization within the product |
| App activity — other user-generated content | Yes | Yes for a shared Line and Corner acknowledgements; private Log stays private | No | App functionality, personalization |
| Financial info — purchase history | Yes | No, except Google Play/RevenueCat/Stripe as service providers | Yes | Subscription entitlement and account management |
| Device or other IDs — push token | Yes | No, except Expo as a service provider | Yes | Notifications and app functionality |
| Basic technical data — timezone/app version/user agent | Yes | No, except infrastructure providers | No | App functionality, security, diagnostics |

Important provider disclosures already represented in the privacy policy: Vercel, Neon, Amazon SES, Anthropic, Voyage AI, Expo, Stripe, and RevenueCat. Before final submission, compare this table with the current Google Play SDK Index disclosures for RevenueCat and any SDK added after this package was prepared.

## Monetization and products

The in-app UI currently presents:

- Reisei Pro monthly: `$6.99/month`
- Reisei Pro annual: `$49.99/year`
- Corner: `$4.99/seat/month` (web/organization offering)
- Seven-day free trial language appears in the app

Create and activate the matching Google Play subscription products/base plans in Play Console and RevenueCat before production review. Store pricing shown by Google Play must match the live in-app products for the reviewer’s country.

## Release/setup details

- Production artifact: Android App Bundle (`.aab`)
- Release track currently configured in EAS: Internal
- Android package: `com.muworks.reisei`
- Orientation: Portrait
- Notification permission: `android.permission.POST_NOTIFICATIONS`
- Google Play App Signing: enable/use it
- First AAB: upload manually once before relying on EAS Submit

## Submission blockers to resolve

1. **Create a public account-deletion page.** Google requires an external deletion-request pathway even though Settings already supports in-app deletion. Recommended URL: `https://www.reiseiapp.com/delete-account`. It should identify Reisei/Mu Works LLC, let a user request deletion without reinstalling the app (a form or prominent `support@reiseiapp.com` mail link is acceptable), explain what is deleted/retained, and explain subscription cancellation separately.
2. **Verify the public URLs.** The submission requires the website, privacy-policy URL, and deletion URL to load publicly without authentication, geoblocking, or errors.
3. **Align the age statement.** Change “under 17” in the privacy policy to “under 18,” or choose a Play target audience that exactly matches a revised policy.
4. **Confirm developer-account contact details.** Play Console requires a verified support email; an organization developer account also requires a verified public developer phone number. Because the app is monetized, make sure the organization’s legal address/payment profile is current.
5. **Complete the IARC questionnaire truthfully.** Declare limited invite-only user interaction/user-generated content. Google assigns the final rating.
6. **Verify subscriptions and trial claims.** The Play products, prices, trial eligibility, RevenueCat entitlements, and the paywall copy must agree.
7. **Confirm tablet distribution.** Phone screenshots are complete. If Play Console treats the Android build as tablet/Chromebook compatible and you intend to distribute there, add the required large-screen screenshot sets or exclude unsupported form factors.

## Current official requirement references

- Preview assets and screenshot rules: https://support.google.com/googleplay/android-developer/answer/9866151
- Data safety: https://support.google.com/googleplay/android-developer/answer/10787469
- Account deletion: https://support.google.com/googleplay/android-developer/answer/13327111
- Health apps declaration: https://support.google.com/googleplay/android-developer/answer/14738291
- Content ratings: https://support.google.com/googleplay/android-developer/answer/9898843
- Store contact details: https://support.google.com/googleplay/android-developer/answer/13634081
