# RevenueCat subscriptions in Expo

Reisei uses RevenueCat for mobile subscriptions and Stripe for web checkout.
The mobile entitlement is `Reisei Pro`; it unlocks the same Reisei Pro access
as the server plan after RevenueCat delivers the webhook.

## 1. Install and rebuild

The SDK is installed with Expo's compatible dependency command:

```sh
npx expo install react-native-purchases react-native-purchases-ui
```

Both packages contain native code. Expo Go can show RevenueCat's Preview API
mode but cannot process real store purchases. Use a development build after an
installation or native dependency update:

```sh
eas build --platform ios --profile development
eas build --platform android --profile development
```

## 2. SDK keys and environments

The public SDK key is allowed in the client bundle. It identifies the app to
RevenueCat; it is not the RevenueCat secret API key. Keep
`REVENUECAT_SECRET_API_KEY` and `REVENUECAT_WEBHOOK_AUTH` server-only.

The supplied `test_NDlwmOizqCXeLEdnyulQOQRgLUK` is configured only in the
`development` EAS profile. The app also requires `__DEV__`, so a Test Store key
cannot be used in a release build. Never submit it to App Store Connect or
Google Play.

For preview and production, create platform-specific public keys in the
RevenueCat dashboard and store them in EAS environment variables:

```sh
eas env:create --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value <ios_public_sdk_key> --environment production --visibility plaintext
eas env:create --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY --value <android_public_sdk_key> --environment production --visibility plaintext
eas env:create --name EXPO_PUBLIC_REVENUECAT_ENTITLEMENT --value 'Reisei Pro' --environment production --visibility plaintext
```

Repeat the platform-key setup for the `preview` environment if it will use
real sandbox/test-track purchases. Do not set
`EXPO_PUBLIC_REVENUECAT_USE_TEST_STORE=true` outside a development build.

## 3. Configure RevenueCat products and offering

1. In App Store Connect, create an auto-renewable subscription with product ID
   `monthly`, then another with product ID `yearly`. Complete its required
   metadata, pricing, localization, and review information.
2. In Google Play Console, create subscription products with product IDs
   `monthly` and `yearly`. For each, create and activate at least one base plan
   before testing it through RevenueCat.
3. Add the iOS and Android apps to the same RevenueCat project and connect
   App Store Connect / Google Play credentials.
4. Create the entitlement with the exact identifier `Reisei Pro`.
5. Add both store products to RevenueCat. Attach `monthly` to a monthly package
   (`$rc_monthly`) and `yearly` to an annual package (`$rc_annual`).
6. Create an offering and set it as the **current** offering. A RevenueCat
   Paywall is not required: Reisei loads the offering and presents its existing
   monthly and yearly purchase choices.

The package identifiers (`$rc_monthly` and `$rc_annual`) are RevenueCat
package types. The underlying store product IDs remain exactly `monthly` and
`yearly`.

## 4. Customer identity, entitlement, and webhooks

`src/lib/auth/AuthProvider.tsx` configures RevenueCat once a Reisei user signs
in, passing their account UUID as `appUserID`. It logs that identity out when
the account is signed out or deleted. Do not use an email address or a mutable
username for the RevenueCat app user ID.

`src/lib/billing/iap.ts` retrieves `CustomerInfo`, checks
`customerInfo.entitlements.active['Reisei Pro']`, and subscribes to CustomerInfo
updates. The app uses that check for immediate purchase/restore feedback.

For durable feature authorization, configure a RevenueCat webhook to the
existing endpoint:

```text
POST https://www.reiseiapp.com/api/webhooks/revenuecat
Authorization: <the value of REVENUECAT_WEBHOOK_AUTH>
```

Set the same authorization value as `REVENUECAT_WEBHOOK_AUTH` on the server.
The webhook accepts only lifecycle events carrying the `Reisei Pro`
entitlement, then updates Reisei's server-side plan; do not trust a
client-side entitlement alone to grant protected API access. RevenueCat can
retry delivery, so keep this endpoint idempotent and use RevenueCat's dashboard
test event before launch.

## 5. Purchases, restore, and Customer Center

The native app loads the current RevenueCat offering and completes purchases
from Reisei's monthly and yearly buttons. There is no RevenueCat dashboard
Paywall to design or publish. Settings includes a restore path.

Settings also shows **Manage mobile subscription** for paid native customers.
It presents RevenueCat Customer Center when it has been enabled and configured
in the RevenueCat dashboard. Customer Center is a RevenueCat Pro/Enterprise
feature; retain the existing Stripe customer portal for web purchases.

## 6. Test checklist

1. Run a development build with the configured Test Store key, or use iOS
   sandbox / Google Play internal testing with the platform public keys.
2. Sign in before opening the Paywall and confirm the RevenueCat customer ID is
   the Reisei UUID.
3. Purchase `monthly` and `yearly` separately. Confirm each activates
   `Reisei Pro` in CustomerInfo and that the webhook changes the server plan.
4. Cancel a Paywall purchase, restore an existing purchase, sign out/in, and
   verify Customer Center and the store's native subscription-management link.
5. Before release, remove every Test Store variable from release environments,
   confirm the current offering is published, and test an actual store build.
