import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Body, Button, Caption, Card, Eyebrow, Mono, Screen, Text, Title } from '@/components';
import { useAuth } from '@/lib/auth/AuthProvider';
import { billingApi } from '@/lib/billing/client';
import { iapEnabled, restore } from '@/lib/billing/iap';
import { setHoldTime } from '@/lib/data/client';
import { color, radius, space } from '@/theme';

const TIER_LABEL: Record<string, string> = { free: 'Free', pro: 'Reisei Pro', team: 'Crew · Team seat' };
const HOLD_TIMES = ['18:00', '20:00', '22:00'];

export default function Settings() {
  const { user, entitlement, logout, refresh } = useAuth();
  const [portalAvailable, setPortalAvailable] = useState(false);
  const [hold, setHold] = useState(user?.holdTime ?? '20:00');

  useEffect(() => {
    void billingApi.status().then((r) => setPortalAvailable(Boolean(r.data.portalAvailable)));
  }, []);
  useEffect(() => {
    if (user?.holdTime) setHold(user.holdTime);
  }, [user?.holdTime]);

  async function openPortal() {
    const res = await billingApi.portal();
    if (res.data.url) void Linking.openURL(res.data.url);
  }

  async function pickHold(t: string) {
    setHold(t);
    await setHoldTime(t);
    await refresh();
  }

  return (
    <Screen>
      <Title>You</Title>

      <Card>
        <Eyebrow>Account</Eyebrow>
        <Body color={color.textPrimary}>{user?.name}</Body>
        <Mono>{`@${user?.username ?? ''} · ${user?.tz ?? 'UTC'}`}</Mono>
      </Card>

      <Card>
        <Eyebrow>Plan</Eyebrow>
        <Body color={color.textPrimary}>{TIER_LABEL[entitlement?.tier ?? 'free']}</Body>
        {entitlement?.tier === 'free' ? (
          <Button label="Go Pro" onPress={() => router.push('/paywall')} />
        ) : (
          <View style={styles.stack}>
            {portalAvailable && <Button label="Manage billing" variant="secondary" onPress={openPortal} />}
            {iapEnabled() && <Button label="Restore purchases" variant="ghost" onPress={() => restore()} />}
          </View>
        )}
      </Card>

      <Card>
        <Eyebrow>Ledger</Eyebrow>
        <Caption>The shape of your composure — hold calendar, hold-rate, where breaks cluster.</Caption>
        <Button label="Open the Ledger" variant="secondary" onPress={() => router.push('/ledger')} />
      </Card>

      <Card>
        <Eyebrow>Coach</Eyebrow>
        <Caption>When to nudge you if the line's still open. The coach stays quiet on a held day.</Caption>
        <View style={styles.chips}>
          {HOLD_TIMES.map((t) => (
            <Pressable key={t} onPress={() => pickHold(t)} style={[styles.chip, hold === t && styles.chipActive]}>
              <Text variant="mono" color={hold === t ? color.bg : color.textBody}>
                {t}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Eyebrow>Session</Eyebrow>
        <Button label="Log out" variant="secondary" onPress={logout} />
      </Card>

      <Caption>{`Reisei · Mu Works LLC${Platform.OS !== 'web' ? ' · IAP via RevenueCat' : ''}`}</Caption>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  chips: { flexDirection: 'row', gap: space.sm },
  chip: {
    flex: 1,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.rule,
    alignItems: 'center',
  },
  chipActive: { backgroundColor: color.action, borderColor: color.action },
});
