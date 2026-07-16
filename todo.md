# Reisei launch checklist

## RevenueCat

- [x] Use the live `Reisei Pro` entitlement.
- [x] Add RevenueCat records for iOS and Android monthly and annual products.
- [x] Attach the 1.5 products to the current monthly and annual offering packages.
- [ ] Finish App Store availability and territory pricing for `reisei_pro_m_1299_2026` and `reisei_pro_y_9900_2026`.
- [x] Repair Google Play credentials, then verify `reisei_pro:monthly` and `reisei_pro:annual` against the store.
- [x] Add production public SDK keys to EAS environment variables.
- [x] Add `REVENUECAT_WEBHOOK_AUTH`, then configure and test the RevenueCat webhook at `/api/webhooks/revenuecat`.
- [ ] Enable Customer Center if the RevenueCat plan includes it.
- [ ] Test purchase, cancellation, restore, sign-out/sign-in, and expiration flows in store testing.

## App Store and Play

- [ ] Upload the six 1284 × 2778 Apple screenshots from `~/Desktop/reisei-apple-app-store/screenshots-6.9in`.
- [ ] Complete App Store availability and pricing, then submit the 1.5 monthly and annual products for review.
- [ ] Complete Google Play subscription/base-plan setup and internal testing.
- [ ] Confirm the privacy policy and account-deletion request path are live.
- [ ] Build and test release candidates on a physical iPhone and Android device.
