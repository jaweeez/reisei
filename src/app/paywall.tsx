import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { Body, Button, Caption, Card, Eyebrow, Screen, Text, Title, VialMark } from '@/components';
import { useAuth } from '@/lib/auth/AuthProvider';
import { billingApi, type Interval } from '@/lib/billing/client';
import { configureIap, getProPackages, iapEnabled, purchase, restore } from '@/lib/billing/iap';
import { color, space } from '@/theme';

const APP_URL = (process.env.EXPO_PUBLIC_APP_URL || 'https://reiseiapp.com').replace(/\/$/, '');

export default function Paywall() {
  const { user, refresh } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) void configureIap(user.id);
  }, [user?.id]);

  async function buyPro(interval: Interval) {
    setBusy(`pro-${interval}`);
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
      }
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
    try {
      const res = await billingApi.checkout('seat', interval, 3);
      if (res.data.url) void Linking.openURL(res.data.url);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <View style={styles.head}>
        <VialMark width={140} />
        <Title style={{ marginTop: space.lg }}>Stay level, together</Title>
        <Caption center>Free to join a Corner. Pay to lead one.</Caption>
      </View>

      <Card>
        <Eyebrow>Reisei Pro</Eyebrow>
        <Text variant="display" color={color.textPrimary}>$6.99<Text variant="caption">/mo</Text></Text>
        <Body>Create & captain a Corner, full history, streak insurance, widgets, and advanced reminders.</Body>
        <Button label="Go Pro · Monthly" onPress={() => buyPro('monthly')} loading={busy === 'pro-monthly'} />
        <Button label="Go Pro · Annual · $49.99/yr" variant="secondary" onPress={() => buyPro('annual')} loading={busy === 'pro-annual'} />
        <Caption>7-day free trial. Cancel anytime.</Caption>
      </Card>

      <Card>
        <Eyebrow>Corner · Team</Eyebrow>
        <Text variant="display" color={color.textPrimary}>$4.99<Text variant="caption">/seat/mo</Text></Text>
        <Body>Sponsor your whole Corner. Every seated member gets Pro, and you get captain tools. Min 3 seats.</Body>
        <Button label="Sponsor a Corner" variant="secondary" onPress={() => buyTeam('monthly')} loading={busy === 'team-monthly'} />
        {Platform.OS !== 'web' && <Caption>Team seats are managed on reiseiapp.com.</Caption>}
      </Card>

      {iapEnabled() && <Button label="Restore purchases" variant="ghost" onPress={() => restore()} />}
      <Button label="Not now" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', marginTop: space.xl, gap: space.xs },
});
