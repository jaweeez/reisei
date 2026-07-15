import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import {
  Body,
  Button,
  Caption,
  Chip,
  CrisisCard,
  HeroPanel,
  InlineNotice,
  Input,
  ListRow,
  Mono,
  PageHeader,
  Screen,
  Section,
} from '@/components';
import { confirm } from '@/lib/alerts';
import { useAuth } from '@/lib/auth/AuthProvider';
import { billingApi } from '@/lib/billing/client';
import { iapEnabled, presentCustomerCenter, restore } from '@/lib/billing/iap';
import { setHoldTime } from '@/lib/data/client';
import { color, space } from '@/theme';

const TIER_LABEL: Record<string, string> = { free: 'Free', pro: 'Reisei Pro', team: 'Covered member', org: 'Organization' };
const HOLD_TIMES = ['18:00', '20:00', '22:00'];

export default function Settings() {
  const { user, entitlement, logout, refresh, deleteAccount } = useAuth();
  const [portalAvailable, setPortalAvailable] = useState(false);
  const [hold, setHold] = useState(user?.holdTime ?? '20:00');
  const [busy, setBusy] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [delOpen, setDelOpen] = useState(false);
  const [delPin, setDelPin] = useState('');
  const [delErr, setDelErr] = useState<string | null>(null);

  useEffect(() => { void billingApi.status().then((r) => setPortalAvailable(Boolean(r.data.portalAvailable))); }, []);

  async function openPortal() {
    setBusy('portal');
    try {
      const res = await billingApi.portal();
      if (res.data.url) void Linking.openURL(res.data.url);
    } finally { setBusy(null); }
  }

  async function onRestore() {
    setBusy('restore');
    setBillingError(null);
    try {
      if (await restore()) await refresh();
      else setBillingError('No Reisei Pro purchase was found for this store account.');
    } finally { setBusy(null); }
  }

  async function openCustomerCenter() {
    setBusy('customer-center');
    setBillingError(null);
    try {
      if (!(await presentCustomerCenter())) setBillingError('Subscription management is unavailable right now. Try restoring purchases or use your store account.');
    } finally { setBusy(null); }
  }

  async function pickHold(time: string) {
    setHold(time);
    setBusy('hold');
    try { await setHoldTime(time); await refresh(); } finally { setBusy(null); }
  }

  async function onDelete() {
    if (!(await confirm('Delete account?', 'Delete your account permanently? This erases everything and cannot be undone.', 'Delete'))) return;
    setBusy('delete');
    setDelErr(null);
    const err = await deleteAccount(delPin);
    setBusy(null);
    if (err) setDelErr(err);
  }

  return (
    <Screen>
      <PageHeader title="You" context={`@${user?.username ?? ''}`} />

      <HeroPanel>
        <Body color={color.textPrimary}>{user?.name}</Body>
        <Mono>{`${TIER_LABEL[entitlement?.tier ?? 'free']} · ${user?.tz ?? 'UTC'}`}</Mono>
        {entitlement?.coverage ? <Caption>{`${entitlement.coverage.used} of ${entitlement.coverage.total} invited people covered.`}</Caption> : null}
        {entitlement?.coveredByPro ? <Caption>Your Pro access is covered by your Crew captain.</Caption> : null}
      </HeroPanel>

      <Section label="Profile">
        <ListRow
          title={user?.email ?? 'Add recovery email'}
          detail={user?.email ? (user.emailVerified ? 'Verified recovery email' : 'Email not verified') : 'Recover your account if you forget your PIN'}
          trailing={<Mono>OPEN</Mono>}
          onPress={() => router.push({ pathname: '/verify-email', params: user?.email ? { change: '1' } : {} })}
        />
      </Section>

      <Section label="Plan and billing">
        <ListRow title={TIER_LABEL[entitlement?.tier ?? 'free']} detail={entitlement?.tier === 'pro' ? 'You plus two invited people' : undefined} />
        {entitlement?.tier === 'free' ? <Button label="Go Pro" onPress={() => router.push('/paywall')} /> : null}
        {portalAvailable ? <Button label="Manage web billing" variant="secondary" onPress={openPortal} loading={busy === 'portal'} /> : null}
        {iapEnabled() ? <Button label="Manage mobile subscription" variant="secondary" onPress={openCustomerCenter} loading={busy === 'customer-center'} /> : null}
        {iapEnabled() ? <Button label="Restore purchases" variant="ghost" onPress={onRestore} loading={busy === 'restore'} /> : null}
        {billingError ? <Caption color={color.actionText}>{billingError}</Caption> : null}
        {(entitlement?.tier === 'org' || entitlement?.ownsOrg) ? (
          <ListRow title="Organization" detail="Groups, seats, and invites" trailing={<Mono>OPEN</Mono>} onPress={() => router.push('/org')} />
        ) : null}
      </Section>

      <Section label="Coach and reminders">
        <Caption>When to nudge you if the Line is still open. The coach stays quiet on a held day.</Caption>
        <View style={styles.chips}>
          {HOLD_TIMES.map((time) => (
            <Chip key={time} label={time} active={hold === time} onPress={() => pickHold(time)} disabled={busy === 'hold'} style={styles.grow} />
          ))}
        </View>
        <ListRow title="The Bearing" detail="Schools and daily principles" trailing={<Mono>OPEN</Mono>} onPress={() => router.push('/bearing')} />
        <ListRow title="The Ledger" detail="Cycles, history, and private reports" trailing={<Mono>OPEN</Mono>} onPress={() => router.push('/ledger')} />
      </Section>

      <Section label="Privacy and safety">
        <InlineNotice label="Crew privacy" body="Your Crew sees your Line and posture. Your Log, notes, Bearings, recovery details, and review answers stay private." />
        <CrisisCard />
        <Pressable onPress={() => router.push('/privacy')} hitSlop={8} accessibilityRole="link" style={styles.legal}><Mono>Privacy policy</Mono></Pressable>
      </Section>

      {entitlement?.isAdmin ? (
        <Section label="Administration">
          <ListRow title="Platform admin" detail="Users, Crews, and Pro grants" trailing={<Mono>OPEN</Mono>} onPress={() => router.push('/admin')} />
        </Section>
      ) : null}

      <Section label="Account">
        <Button
          label="Log out"
          variant="secondary"
          loading={busy === 'logout'}
          onPress={async () => { setBusy('logout'); await logout(); setBusy(null); }}
        />
        {!delOpen ? (
          <Button label="Delete account" variant="ghost" onPress={() => setDelOpen(true)} />
        ) : (
          <View style={styles.delete}>
            <Caption>Delete your Line, Ledger, Log, Crew standing, and account permanently.</Caption>
            <Input placeholder="Enter your PIN to confirm" value={delPin} onChangeText={setDelPin} keyboardType="number-pad" secureTextEntry maxLength={8} />
            {delErr ? <Body color={color.actionText}>{delErr}</Body> : null}
            <Button label="Delete permanently" variant="secondary" onPress={onDelete} loading={busy === 'delete'} disabled={delPin.length < 4} />
            <Button label="Cancel" variant="ghost" onPress={() => { setDelOpen(false); setDelPin(''); setDelErr(null); }} />
          </View>
        )}
      </Section>

      <Caption center>Reisei 1.5 · Mu Works LLC</Caption>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: space.sm },
  grow: { flex: 1 },
  legal: { alignItems: 'center', paddingVertical: space.sm },
  delete: { gap: space.md },
});
