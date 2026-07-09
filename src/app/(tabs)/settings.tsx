import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Body, Button, Caption, Card, CrisisCard, Eyebrow, Mono, Screen, Text, Title } from '@/components';
import { useAuth } from '@/lib/auth/AuthProvider';
import { billingApi } from '@/lib/billing/client';
import { iapEnabled, restore } from '@/lib/billing/iap';
import { setHoldTime } from '@/lib/data/client';
import { color, radius, space } from '@/theme';

const TIER_LABEL: Record<string, string> = { free: 'Free', pro: 'Reisei Pro', team: 'Corner · Team seat' };
const HOLD_TIMES = ['18:00', '20:00', '22:00'];

export default function Settings() {
  const { user, entitlement, logout, refresh, deleteAccount } = useAuth();
  const [portalAvailable, setPortalAvailable] = useState(false);
  const [hold, setHold] = useState(user?.holdTime ?? '20:00');
  const [delOpen, setDelOpen] = useState(false);
  const [delPin, setDelPin] = useState('');
  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState<string | null>(null);

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

  async function onDelete() {
    if (!(await confirmDelete())) return;
    setDelBusy(true);
    setDelErr(null);
    const err = await deleteAccount(delPin);
    setDelBusy(false);
    // On success the provider flips to guest and (tabs)/_layout redirects to /landing.
    if (err) setDelErr(err);
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
        <Eyebrow>Email</Eyebrow>
        {user?.email ? (
          <>
            <Body color={color.textPrimary}>{user.email}</Body>
            <Mono>{user.emailVerified ? 'Verified' : 'Unverified'}</Mono>
            {user.emailVerified ? (
              <Button label="Change email" variant="ghost" onPress={() => router.push({ pathname: '/verify-email', params: { change: '1' } })} />
            ) : (
              <Button label="Verify email" variant="secondary" onPress={() => router.push('/verify-email')} />
            )}
          </>
        ) : (
          <>
            <Caption>Add an email so you can recover your account if you forget your PIN.</Caption>
            <Button label="Add email" variant="secondary" onPress={() => router.push('/verify-email')} />
          </>
        )}
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
        <Eyebrow>The Bearing</Eyebrow>
        <Caption>A daily principle to steer by, from the schools you follow. Perspective when your head gets loud.</Caption>
        <Button label="Set your bearing" variant="secondary" onPress={() => router.push('/bearing')} />
      </Card>

      <Card>
        <Eyebrow>Ledger</Eyebrow>
        <Caption>The shape of your composure: hold calendar, hold-rate, where the hard days land.</Caption>
        <Button label="Open the Ledger" variant="secondary" onPress={() => router.push('/ledger')} />
      </Card>

      {entitlement?.isAdmin && (
        <Card>
          <Eyebrow>Admin</Eyebrow>
          <Caption>Platform oversight: every user and Corner, and grant/revoke Pro.</Caption>
          <Button label="Open Admin" variant="secondary" onPress={() => router.push('/admin')} />
        </Card>
      )}

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

      <CrisisCard />

      <Card>
        <Eyebrow>Session</Eyebrow>
        <Button label="Log out" variant="secondary" onPress={logout} />
      </Card>

      <Card>
        <Eyebrow>Danger zone</Eyebrow>
        <Caption>Delete your account and everything in it: your line, streak, log, and Corner standing. This cannot be undone.</Caption>
        {!delOpen ? (
          <Button label="Delete account" variant="ghost" onPress={() => setDelOpen(true)} />
        ) : (
          <>
            <TextInput
              placeholder="Enter your PIN to confirm"
              placeholderTextColor={color.textSecondary}
              value={delPin}
              onChangeText={setDelPin}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
              style={styles.input}
            />
            {delErr && <Body color={color.actionText}>{delErr}</Body>}
            <Button label="Delete permanently" onPress={onDelete} loading={delBusy} disabled={delPin.length < 4} />
            <Button
              label="Cancel"
              variant="ghost"
              onPress={() => {
                setDelOpen(false);
                setDelPin('');
                setDelErr(null);
              }}
            />
          </>
        )}
      </Card>

      <Pressable onPress={() => router.push('/privacy')} hitSlop={8} style={styles.legal}>
        <Mono>Privacy policy</Mono>
      </Pressable>

      <Caption>{`Reisei · Mu Works LLC${Platform.OS !== 'web' ? ' · IAP via RevenueCat' : ''}`}</Caption>
    </Screen>
  );
}

function confirmDelete(): Promise<boolean> {
  const msg = 'Delete your account permanently? This erases everything and cannot be undone.';
  if (Platform.OS === 'web') return Promise.resolve(typeof window !== 'undefined' ? window.confirm(msg) : true);
  return new Promise((res) =>
    Alert.alert('Delete account?', msg, [
      { text: 'Cancel', style: 'cancel', onPress: () => res(false) },
      { text: 'Delete', style: 'destructive', onPress: () => res(true) },
    ]),
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  legal: { alignItems: 'center', paddingVertical: space.sm },
  input: {
    minHeight: 52,
    backgroundColor: color.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.rule,
    paddingHorizontal: space.lg,
    color: color.textPrimary,
    fontFamily: 'IBMPlexSans_400Regular',
    fontSize: 16,
  },
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
