import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Body, Button, Caption, Card, Chip, CrisisCard, Eyebrow, Input, Mono, Screen, Title } from '@/components';
import { confirm } from '@/lib/alerts';
import { useAuth } from '@/lib/auth/AuthProvider';
import { billingApi } from '@/lib/billing/client';
import { iapEnabled, restore } from '@/lib/billing/iap';
import { setHoldTime } from '@/lib/data/client';
import { color, space } from '@/theme';

const TIER_LABEL: Record<string, string> = { free: 'Free', pro: 'Reisei Pro', team: 'Corner seat', org: 'Organization' };
const HOLD_TIMES = ['18:00', '20:00', '22:00'];

export default function Settings() {
  const { user, entitlement, logout, refresh, deleteAccount } = useAuth();
  const [portalAvailable, setPortalAvailable] = useState(false);
  const [hold, setHold] = useState(user?.holdTime ?? '20:00');
  const [holdBusy, setHoldBusy] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
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
    setPortalBusy(true);
    try {
      const res = await billingApi.portal();
      if (res.data.url) void Linking.openURL(res.data.url);
    } finally {
      setPortalBusy(false);
    }
  }

  async function onRestore() {
    setRestoreBusy(true);
    try {
      await restore();
    } finally {
      setRestoreBusy(false);
    }
  }

  async function onLogout() {
    setLogoutBusy(true);
    try {
      await logout();
    } finally {
      setLogoutBusy(false);
    }
  }

  async function pickHold(t: string) {
    setHold(t);
    setHoldBusy(true);
    try {
      await setHoldTime(t);
      await refresh();
    } finally {
      setHoldBusy(false);
    }
  }

  async function onDelete() {
    if (!(await confirm('Delete account?', 'Delete your account permanently? This erases everything and cannot be undone.', 'Delete'))) return;
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
            {portalAvailable && <Button label="Manage billing" variant="secondary" onPress={openPortal} loading={portalBusy} />}
            {iapEnabled() && <Button label="Restore purchases" variant="ghost" onPress={onRestore} loading={restoreBusy} />}
          </View>
        )}
      </Card>

      {/* ownsOrg keeps this reachable after a lapse — the dashboard carries the renew path. */}
      {(entitlement?.tier === 'org' || entitlement?.ownsOrg) && (
        <Card>
          <Eyebrow>Organization</Eyebrow>
          <Caption>Your groups, seats, and invites in one place.</Caption>
          <Button label="Open your organization" variant="secondary" onPress={() => router.push('/org')} />
        </Card>
      )}

      <Card>
        <Eyebrow>Coach</Eyebrow>
        <Caption>When to nudge you if the line's still open. The coach stays quiet on a held day.</Caption>
        <View style={styles.chips}>
          {HOLD_TIMES.map((t) => (
            <Chip key={t} label={t} active={hold === t} onPress={() => void pickHold(t)} disabled={holdBusy} style={{ flex: 1 }} />
          ))}
        </View>
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

      <CrisisCard />

      {entitlement?.isAdmin && (
        <Card>
          <Eyebrow>Admin</Eyebrow>
          <Caption>Platform oversight: every user and Corner, and grant/revoke Pro.</Caption>
          <Button label="Open Admin" variant="secondary" onPress={() => router.push('/admin')} />
        </Card>
      )}

      <Card>
        <Eyebrow>Session</Eyebrow>
        <Button label="Log out" variant="secondary" onPress={onLogout} loading={logoutBusy} />
      </Card>

      <Card>
        <Eyebrow>Delete account</Eyebrow>
        <Caption>Delete your account and everything in it: your line, streak, log, and Corner standing. This cannot be undone.</Caption>
        {!delOpen ? (
          <Button label="Delete" variant="ghost" onPress={() => setDelOpen(true)} />
        ) : (
          <>
            <Input
              inCard
              placeholder="Enter your PIN to confirm"
              value={delPin}
              onChangeText={setDelPin}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
            />
            {delErr && <Body color={color.actionText}>{delErr}</Body>}
            <Button label="Delete permanently" variant="secondary" onPress={onDelete} loading={delBusy} disabled={delPin.length < 4} />
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

      <Pressable onPress={() => router.push('/privacy')} hitSlop={8} accessibilityRole="link" style={styles.legal}>
        <Mono>Privacy policy</Mono>
      </Pressable>

      <Caption center>Reisei · Mu Works LLC</Caption>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  legal: { alignItems: 'center', paddingVertical: space.sm },
  chips: { flexDirection: 'row', gap: space.sm },
});
