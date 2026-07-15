/**
 * RevenueCat mobile subscriptions for iOS and Android.
 *
 * Purchases are configured only after Reisei authentication, using the stable
 * account UUID as RevenueCat's app user ID. The client uses CustomerInfo for
 * immediate UI feedback; the RevenueCat webhook remains the authoritative
 * source that updates users.plan on the server.
 *
 * Dashboard contract:
 *   entitlement: Reisei Pro
 *   products: monthly and yearly
 *   offering: current, with $rc_monthly -> monthly and $rc_annual -> yearly
 */
import { Platform } from 'react-native';
import type { CustomerInfo, CustomerInfoUpdateListener, PurchasesPackage } from 'react-native-purchases';

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
const TEST_STORE_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_KEY;
const USE_TEST_STORE = process.env.EXPO_PUBLIC_REVENUECAT_USE_TEST_STORE === 'true';

/** RevenueCat entitlement identifier — not an App Store or Play product ID. */
export const ENTITLEMENT_ID = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT || 'Reisei Pro';

type PurchasesStatic = typeof import('react-native-purchases').default;
type RevenueCatUIStatic = typeof import('react-native-purchases-ui').default;

let Purchases: PurchasesStatic | null = null;
let RevenueCatUI: RevenueCatUIStatic | null = null;
let sdkConfigured = false;
let configuredFor: string | null = null;

function apiKey(): string | undefined {
  // RevenueCat Test Store keys are for local development only. A release build
  // must use the platform-specific public key supplied through EAS environment
  // variables. __DEV__ keeps a test_ key out of an App Store / Play release.
  if (__DEV__ && USE_TEST_STORE && TEST_STORE_KEY) return TEST_STORE_KEY;
  if (Platform.OS === 'ios') return IOS_KEY;
  if (Platform.OS === 'android') return ANDROID_KEY;
  return undefined;
}

export function iapEnabled(): boolean {
  return (Platform.OS === 'ios' || Platform.OS === 'android') && !!apiKey();
}

function loadPurchases(): PurchasesStatic | null {
  if (!iapEnabled()) return null;
  if (!Purchases) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      Purchases = (require('react-native-purchases') as { default: PurchasesStatic }).default;
    } catch {
      return null;
    }
  }
  return Purchases;
}

function loadUi(): RevenueCatUIStatic | null {
  if (!iapEnabled()) return null;
  if (!RevenueCatUI) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      RevenueCatUI = (require('react-native-purchases-ui') as { default: RevenueCatUIStatic }).default;
    } catch {
      return null;
    }
  }
  return RevenueCatUI;
}

/** Configure once, then identify each signed-in Reisei account with Purchases.logIn. */
export async function configureIap(appUserId: string): Promise<void> {
  const P = loadPurchases();
  const key = apiKey();
  if (!P || !key || configuredFor === appUserId) return;

  try {
    if (!sdkConfigured) {
      P.configure({ apiKey: key, appUserID: appUserId });
      sdkConfigured = true;
    } else {
      await P.logIn(appUserId);
    }
    configuredFor = appUserId;
  } catch {
    // Billing is optional app functionality: never block sign-in on SDK setup.
  }
}

/** Clear the RevenueCat identity when a Reisei account is signed out or deleted. */
export async function logOutIap(): Promise<void> {
  const P = loadPurchases();
  if (!P || !sdkConfigured) return;
  try {
    await P.logOut();
    configuredFor = null;
  } catch {
    // The app's own session logout must still complete if the store is offline.
  }
}

/** Retrieve the cached/fresh RevenueCat customer record for diagnostics or UI. */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  const P = loadPurchases();
  if (!P || !sdkConfigured) return null;
  try {
    return await P.getCustomerInfo();
  } catch {
    return null;
  }
}

/** True only when RevenueCat says that this customer currently owns Reisei Pro. */
export function hasReiseiPro(customerInfo: CustomerInfo | null | undefined): boolean {
  return !!customerInfo?.entitlements.active[ENTITLEMENT_ID];
}

/** React to renewals, restores, and purchases that change CustomerInfo. */
export function onCustomerInfoUpdated(listener: CustomerInfoUpdateListener): () => void {
  const P = loadPurchases();
  if (!P || !sdkConfigured) return () => undefined;
  try {
    P.addCustomerInfoUpdateListener(listener);
    return () => P.removeCustomerInfoUpdateListener(listener);
  } catch {
    return () => undefined;
  }
}

export interface IapPackage {
  id: string;
  /** "annual" maps to the yearly product identifier in the RevenueCat dashboard. */
  interval: 'monthly' | 'annual' | 'other';
  priceString: string;
  raw: PurchasesPackage;
}

/** The Pro packages from the current offering, or [] until the dashboard is configured. */
export async function getProPackages(): Promise<IapPackage[]> {
  const P = loadPurchases();
  if (!P || !sdkConfigured) return [];
  try {
    const offerings = await P.getOfferings();
    return (offerings.current?.availablePackages ?? []).map((pkg) => ({
      id: pkg.product.identifier,
      interval:
        String(pkg.packageType) === 'ANNUAL' || pkg.product.identifier === 'yearly'
          ? 'annual'
          : String(pkg.packageType) === 'MONTHLY' || pkg.product.identifier === 'monthly'
            ? 'monthly'
            : 'other',
      priceString: pkg.product.priceString,
      raw: pkg,
    }));
  } catch {
    return [];
  }
}

export type PurchaseResult = 'purchased' | 'cancelled' | 'error';

/** Buy a package and verify the Reisei Pro entitlement locally before reporting success. */
export async function purchase(pkg: IapPackage): Promise<PurchaseResult> {
  const P = loadPurchases();
  if (!P || !sdkConfigured) return 'error';
  try {
    const { customerInfo } = await P.purchasePackage(pkg.raw);
    return hasReiseiPro(customerInfo) ? 'purchased' : 'error';
  } catch (error) {
    if (error && typeof error === 'object' && (error as { userCancelled?: boolean }).userCancelled) return 'cancelled';
    return 'error';
  }
}

/** App Store and Play policy-friendly restore control. */
export async function restore(): Promise<boolean> {
  const P = loadPurchases();
  if (!P || !sdkConfigured) return false;
  try {
    return hasReiseiPro(await P.restorePurchases());
  } catch {
    return false;
  }
}

/**
 * Customer Center lets a mobile subscriber manage their store subscription.
 * It is available only after enabling and configuring Customer Center in the
 * RevenueCat dashboard (a RevenueCat Pro/Enterprise feature).
 */
export async function presentCustomerCenter(): Promise<boolean> {
  const UI = loadUi();
  if (!UI || !sdkConfigured) return false;
  try {
    await UI.presentCustomerCenter();
    return true;
  } catch {
    return false;
  }
}
