/**
 * Mobile In-App Purchases via RevenueCat (StoreKit 2 on iOS, Play Billing on Android).
 *
 * Gated on native + a configured public key, and the native SDK is required lazily,
 * so web / Expo Go / unconfigured builds never touch it and keep using Stripe.
 * RevenueCat validates receipts and, via its webhook (/api/webhooks/revenuecat),
 * syncs users.plan so the entitlement lifts.
 *
 * Setup (once, by the founder):
 *   - Create auto-renewable subscriptions in App Store Connect + Play Console
 *     (monthly + annual Pro), matching the premium price posture ($6.99 / $49.99).
 *   - In RevenueCat: add both apps, an entitlement identifier "premium", an offering
 *     whose packages point at those products.
 *   - Set EXPO_PUBLIC_REVENUECAT_IOS_KEY / _ANDROID_KEY for the build, and
 *     REVENUECAT_WEBHOOK_AUTH on the server; point the RC webhook at
 *     /api/webhooks/revenuecat with that Authorization value.
 */
import { Platform } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
const ENTITLEMENT_ID = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT || 'premium';

type PurchasesStatic = typeof import('react-native-purchases').default;

let Purchases: PurchasesStatic | null = null;
let configuredFor: string | null = null;

function apiKey(): string | undefined {
  if (Platform.OS === 'ios') return IOS_KEY;
  if (Platform.OS === 'android') return ANDROID_KEY;
  return undefined;
}

export function iapEnabled(): boolean {
  return (Platform.OS === 'ios' || Platform.OS === 'android') && !!apiKey();
}

function load(): PurchasesStatic | null {
  if (!iapEnabled()) return null;
  if (!Purchases) {
    try {
      Purchases = (require('react-native-purchases') as { default: PurchasesStatic }).default;
    } catch {
      return null;
    }
  }
  return Purchases;
}

/** Point RevenueCat at our user id so a purchase maps to the account. Idempotent per user. */
export async function configureIap(appUserId: string): Promise<void> {
  const P = load();
  const key = apiKey();
  if (!P || !key || configuredFor === appUserId) return;
  try {
    P.configure({ apiKey: key, appUserID: appUserId });
    configuredFor = appUserId;
  } catch {
    /* best-effort — never let store setup break the app */
  }
}

export interface IapPackage {
  id: string;
  interval: 'monthly' | 'annual' | 'other';
  priceString: string;
  raw: PurchasesPackage;
}

/** The Pro packages from the current offering, or [] if unavailable. */
export async function getProPackages(): Promise<IapPackage[]> {
  const P = load();
  if (!P) return [];
  try {
    const offerings = await P.getOfferings();
    const packages = offerings.current?.availablePackages ?? [];
    return packages.map((pkg) => ({
      id: pkg.identifier,
      interval:
        String(pkg.packageType) === 'ANNUAL' ? 'annual' : String(pkg.packageType) === 'MONTHLY' ? 'monthly' : 'other',
      priceString: pkg.product.priceString,
      raw: pkg,
    }));
  } catch {
    return [];
  }
}

export type PurchaseResult = 'purchased' | 'cancelled' | 'error';

/** Buy a package. 'purchased' means the 'premium' entitlement is now active on-device. */
export async function purchase(pkg: IapPackage): Promise<PurchaseResult> {
  const P = load();
  if (!P) return 'error';
  try {
    const { customerInfo } = await P.purchasePackage(pkg.raw);
    return customerInfo.entitlements.active[ENTITLEMENT_ID] ? 'purchased' : 'error';
  } catch (e) {
    if (e && typeof e === 'object' && (e as { userCancelled?: boolean }).userCancelled) return 'cancelled';
    return 'error';
  }
}

/** App Store requires a Restore control. Returns true if 'premium' is active afterward. */
export async function restore(): Promise<boolean> {
  const P = load();
  if (!P) return false;
  try {
    const info = await P.restorePurchases();
    return !!info.entitlements.active[ENTITLEMENT_ID];
  } catch {
    return false;
  }
}
