import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Body, Button, Caption, Card, Eyebrow, Input, Mono, Screen, Text, Title, VialMark } from '@/components';
import { useAuth } from '@/lib/auth/AuthProvider';
import { billingApi, type Interval } from '@/lib/billing/client';
import { configureIap, getProPackages, iapEnabled, purchase, restore } from '@/lib/billing/iap';
import { orgApi } from '@/lib/data/client';
import { color, radius, space } from '@/theme';

const APP_URL = (process.env.EXPO_PUBLIC_APP_URL || 'https://reiseiapp.com').replace(/\/$/, '');

const CLOSE_SLOP = { top: 14, bottom: 14, left: 12, right: 12 };

// Only shipped features. Unshipped promises are an App Store metadata risk.
const PRO_FEATURES = [
  'Full Pro for you and two invited people',
  'One private Crew with weekly reviews',
  '14-day Line Reviews and Cycle Reports',
  'Every tradition, unlimited: philosophy, faith, and recovery',
  'Bearings tailored to your log, plus full Ledger and Log history',
  'No ads and no sale of personal data',
];

const ORG_MIN = 9;

function Stepper({
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  value: number;
  min: number;
  max?: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  const atMin = value <= min;
  const atMax = max !== undefined && value >= max;
  return (
    <View style={styles.stepper}>
      <Pressable
        style={styles.stepBtn}
        onPress={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || atMin}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Fewer seats"
      >
        <Mono color={atMin ? color.textSecondary : color.actionText}>-</Mono>
      </Pressable>
      <Mono color={color.textPrimary} style={styles.stepCount}>{`${value} seats`}</Mono>
      <Pressable
        style={styles.stepBtn}
        onPress={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
        disabled={disabled || atMax}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="More seats"
      >
        <Mono color={atMax ? color.textSecondary : color.actionText}>+</Mono>
      </Pressable>
    </View>
  );
}

export default function Paywall() {
  const { user, refresh } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [orgSeats, setOrgSeats] = useState(ORG_MIN);
  const [orgName, setOrgName] = useState('');
  const [orgAvailable, setOrgAvailable] = useState(false);

  useEffect(() => {
    if (user?.id) void configureIap(user.id);
  }, [user?.id]);

  useEffect(() => {
    void billingApi.status().then((r) => setOrgAvailable((r.data.orgIntervals ?? []).length > 0));
  }, []);

  async function buyPro(interval: Interval) {
    setBusy(`pro-${interval}`);
    setError(null);
    try {
      if (iapEnabled()) {
        // Mobile rail: RevenueCat fetches the current offering and completes
        // the StoreKit / Play Billing transaction. A dashboard Paywall is not
        // required; Reisei owns these two purchase choices.
        const pkgs = await getProPackages();
        const pkg = pkgs.find((p) => p.interval === interval) ?? pkgs[0];
        if (pkg && (await purchase(pkg)) === 'purchased') {
          await refresh();
          router.back();
        } else if (!pkg) {
          setError('Subscriptions are still being set up. Please try again soon.');
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

  async function buySeats(interval: 'monthly' | 'annual' = 'monthly') {
    // Per-seat plans are web-only (they can't run on IAP). On mobile, send them to web.
    if (Platform.OS !== 'web') {
      void Linking.openURL(`${APP_URL}/paywall?plan=seat`);
      return;
    }
    setBusy(interval === 'annual' ? 'seat-annual' : 'seat');
    setError(null);
    try {
      const res = await billingApi.checkout('seat', interval, 1);
      if (res.data.url) void Linking.openURL(res.data.url);
      else setError(res.data.error || 'Could not start checkout. Try again.');
    } catch {
      setError('Could not start checkout. Try again.');
    } finally {
      setBusy(null);
    }
  }

  async function buyOrg(interval: 'monthly' | 'annual' = 'monthly') {
    // Per-seat plans are web-only (they can't run on IAP). On mobile, send them to web.
    if (Platform.OS !== 'web') {
      void Linking.openURL(`${APP_URL}/paywall?plan=org`);
      return;
    }
    const name = orgName.trim();
    if (name.length < 2) {
      setError('Give your organization a name.');
      return;
    }
    setBusy(interval === 'annual' ? 'org-annual' : 'org');
    setError(null);
    try {
      const r = await orgApi.create(name);
      let orgId = r.data.id;
      if (!orgId) {
        if (r.data.error?.includes('already run')) {
          // They already run one; checkout against it.
          orgId = (await orgApi.get())?.id;
        }
        if (!orgId) {
          setError(r.data.error || 'Could not start checkout. Try again.');
          return;
        }
      }
      const res = await billingApi.checkout('org', interval, orgSeats, orgId);
      if (res.data.url) void Linking.openURL(res.data.url);
      else setError(res.data.error || 'Could not start checkout. Try again.');
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
        <Caption center>Private accountability. Everyone covered gets the complete member experience.</Caption>
      </View>

      <Card>
        <Eyebrow>Reisei Pro</Eyebrow>
        <Text variant="display" color={color.textPrimary}>$12.99<Text variant="mono" color={color.textBody}> /mo</Text></Text>
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
          label="Go Pro · Annual · $99/yr"
          variant="secondary"
          onPress={() => buyPro('annual')}
          loading={busy === 'pro-annual'}
          disabled={busy !== null && busy !== 'pro-annual'}
        />
        <Caption>7-day free trial. Cancel anytime.</Caption>
      </Card>

      <Card>
        <Eyebrow>Crew</Eyebrow>
        <Text variant="display" color={color.textPrimary}>$24.99<Text variant="mono" color={color.textBody}> /mo</Text></Text>
        <Body>One focused Crew for up to eight people. Everyone gets the complete member experience.</Body>
        <Button
          label="Start a Crew"
          onPress={() => buySeats('monthly')}
          loading={busy === 'seat'}
          disabled={busy !== null && busy !== 'seat'}
        />
        <Button
          label="Annual · $199/yr"
          variant="secondary"
          onPress={() => buySeats('annual')}
          loading={busy === 'seat-annual'}
          disabled={busy !== null && busy !== 'seat-annual'}
        />
        {Platform.OS !== 'web' && <Caption>Crew plans are managed on reiseiapp.com.</Caption>}
      </Card>

      {orgAvailable && (
        <Card>
          <Eyebrow>Organization</Eyebrow>
          <Text variant="display" color={color.textPrimary}>$3.99<Text variant="mono" color={color.textBody}> /seat/mo</Text></Text>
          <Body>Nine or more. Several Crews under one roof. You place people and manage every group without seeing private member work.</Body>
          <Input
            inCard
            placeholder="Organization name"
            value={orgName}
            onChangeText={setOrgName}
            maxLength={60}
          />
          <Stepper value={orgSeats} min={ORG_MIN} onChange={setOrgSeats} disabled={busy !== null} />
          <Button
            label="Start your organization"
            onPress={() => buyOrg('monthly')}
            loading={busy === 'org'}
            disabled={busy !== null && busy !== 'org'}
          />
          <Button
            label={`Annual · $39.99/seat/yr`}
            variant="secondary"
            onPress={() => buyOrg('annual')}
            loading={busy === 'org-annual'}
            disabled={busy !== null && busy !== 'org-annual'}
          />
          {Platform.OS !== 'web' && <Caption>Seats are managed on reiseiapp.com.</Caption>}
        </Card>
      )}

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
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.md, alignSelf: 'center' },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.ruleStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCount: { minWidth: 72, textAlign: 'center' },
});
