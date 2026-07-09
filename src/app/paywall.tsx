import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Body, Button, Caption, Card, Eyebrow, Mono, Screen, Text, Title, VialMark } from '@/components';
import { useAuth } from '@/lib/auth/AuthProvider';
import { billingApi, type Interval } from '@/lib/billing/client';
import { configureIap, getProPackages, iapEnabled, purchase, restore } from '@/lib/billing/iap';
import { color, space } from '@/theme';

const APP_URL = (process.env.EXPO_PUBLIC_APP_URL || 'https://reiseiapp.com').replace(/\/$/, '');

const CLOSE_SLOP = { top: 14, bottom: 14, left: 12, right: 12 };

// Only shipped features. Unshipped promises are an App Store metadata risk.
const PRO_FEATURES = [
  'Create and captain a Corner',
  'The Ledger: your full history',
  'Keep your full log archive',
  'Follow as many schools as you want',
];

export default function Paywall() {
  const { user, refresh } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (user?.id) void configureIap(user.id);
  }, [user?.id]);

  async function buyPro(interval: Interval) {
    setBusy(`pro-${interval}`);
    setError(null);
    try {
      if (iapEnabled()) {
        // Mobile rail: RevenueCat / StoreKit / Play Billing.
        const pkgs = await getProPackages();
        const pkg = pkgs.find((p) => p.interval === interval) ?? pkgs[0];
        if (pkg && (await purchase(pkg)) === 'purchased') {
          await refresh();
          router.back();
        }
      } else {
        // Web rail: Stripe Checkout.
        const res = await billingApi.checkout('pro', interval);
        if (res.data.url) void Linking.openURL(res.data.url);
        else setError('Could not start checkout. Try again.');
      }
    } catch {
      setError('Could not start checkout. Try again.');
    } finally {
      setBusy(null);
    }
  }

  async function buyTeam(interval: Interval) {
    // Team seats are web-only (per-seat can't run on IAP). On mobile, send them to web.
    if (Platform.OS !== 'web') {
      void Linking.openURL(`${APP_URL}/paywall?plan=team`);
      return;
    }
    setBusy(`team-${interval}`);
    setError(null);
    try {
      const res = await billingApi.checkout('seat', interval, 3);
      if (res.data.url) void Linking.openURL(res.data.url);
      else setError('Could not start checkout. Try again.');
    } catch {
      setError('Could not start checkout. Try again.');
    } finally {
      setBusy(null);
    }
  }

  async function restorePurchases() {
    setBusy('restore');
    setError(null);
    setRestored(false);
    try {
      if (await restore()) {
        await refresh();
        setRestored(true);
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <Pressable
        style={styles.close}
        onPress={() => router.back()}
        hitSlop={CLOSE_SLOP}
        accessibilityRole="button"
      >
        <Mono>Close</Mono>
      </Pressable>

      <View style={styles.head}>
        <VialMark width={140} />
        <Title style={{ marginTop: space.lg }}>Stay level, together</Title>
        <Caption center>Free to join a Corner. Pay to lead one.</Caption>
      </View>

      <Card>
        <Eyebrow>Reisei Pro</Eyebrow>
        <Text variant="display" color={color.textPrimary}>$6.99<Text variant="mono" color={color.textBody}> /mo</Text></Text>
        <View style={styles.featureList}>
          {PRO_FEATURES.map((f) => (
            <View key={f} style={styles.featureRow}>
              <Mono color={color.action}>·</Mono>
              <Body style={styles.featureBody}>{f}</Body>
            </View>
          ))}
        </View>
        <Button
          label="Go Pro · Monthly"
          onPress={() => buyPro('monthly')}
          loading={busy === 'pro-monthly'}
          disabled={busy !== null && busy !== 'pro-monthly'}
        />
        <Button
          label="Go Pro · Annual · $49.99/yr"
          variant="secondary"
          onPress={() => buyPro('annual')}
          loading={busy === 'pro-annual'}
          disabled={busy !== null && busy !== 'pro-annual'}
        />
        <Caption>7-day free trial. Cancel anytime.</Caption>
      </Card>

      <Card>
        <Eyebrow>Corner · Team</Eyebrow>
        <Text variant="display" color={color.textPrimary}>$4.99<Text variant="mono" color={color.textBody}> /seat/mo</Text></Text>
        <Body>Sponsor your whole Corner. Every seated member gets Pro, and you get captain tools. Min 3 seats.</Body>
        <Button
          label="Sponsor a Corner"
          variant="secondary"
          onPress={() => buyTeam('monthly')}
          loading={busy === 'team-monthly'}
          disabled={busy !== null && busy !== 'team-monthly'}
        />
        {Platform.OS !== 'web' && <Caption>Team seats are managed on reiseiapp.com.</Caption>}
      </Card>

      {error && <Body color={color.actionText}>{error}</Body>}
      {restored && <Caption>Purchases restored.</Caption>}

      {iapEnabled() && (
        <Button
          label="Restore purchases"
          variant="ghost"
          onPress={restorePurchases}
          loading={busy === 'restore'}
          disabled={busy !== null && busy !== 'restore'}
        />
      )}
      <Button label="Not now" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  close: { alignSelf: 'flex-end' },
  head: { alignItems: 'center', marginTop: space.xl, gap: space.xs },
  featureList: { gap: space.xs },
  featureRow: { flexDirection: 'row', gap: space.sm },
  featureBody: { flex: 1 },
});
