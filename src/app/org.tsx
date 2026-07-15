import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Platform, Share, StyleSheet, View } from 'react-native';
import { Body, Button, Caption, Card, Chip, Eyebrow, Input, Mono, Nudge, Screen, ScreenHeader } from '@/components';
import { confirm, notify } from '@/lib/alerts';
import { billingApi } from '@/lib/billing/client';
import { createCrew, orgApi } from '@/lib/data/client';
import type { OrgMemberView, OrgView } from '@/lib/data/types';
import { color, space } from '@/theme';

// The Organization dashboard: the owner's seats, Corners, people, and live invite codes.

export default function Org() {
  const [org, setOrg] = useState<OrgView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  // The corner id being invited to, or 'org' for a corner-less code.
  const [inviteBusy, setInviteBusy] = useState<string | null>(null);
  const [seatBusy, setSeatBusy] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [newCorner, setNewCorner] = useState('');
  const [cornerBusy, setCornerBusy] = useState(false);

  const load = useCallback(async () => {
    setOrg(await orgApi.get());
    setLoaded(true);
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onPortal() {
    setPortalBusy(true);
    const res = await billingApi.portal();
    setPortalBusy(false);
    if (res.data.url) void Linking.openURL(res.data.url);
    else notify(res.data.error ?? 'Billing is unavailable right now.');
  }

  async function shareCode(code: string, orgName: string) {
    if (Platform.OS === 'web') notify(`Share this code: ${code}`);
    else await Share.share({ message: `Join ${orgName} on Reisei. Code: ${code}` });
  }

  async function onInvite(crewId: string | null) {
    if (!org || inviteBusy) return;
    setInviteBusy(crewId ?? 'org');
    const res = await orgApi.invite(crewId);
    setInviteBusy(null);
    if (res.data.code) {
      await shareCode(res.data.code, org.name);
      await load();
    } else if (res.data.error) notify(res.data.error);
  }

  async function onSeat(m: OrgMemberView) {
    if (seatBusy) return;
    if (m.seated) {
      const ok = await confirm('Release this seat?', `${m.name} loses Pro until re-seated.`, 'Release');
      if (!ok) return;
    }
    setSeatBusy(m.id);
    const res = await orgApi.setSeat(m.id, m.seated ? 'release' : 'assign');
    setSeatBusy(null);
    if (res.data.error) notify(res.data.error);
    await load();
  }

  async function onRevoke(code: string) {
    if (revoking) return;
    const ok = await confirm('Revoke this code?', 'Anyone holding it can no longer join with it.', 'Revoke');
    if (!ok) return;
    setRevoking(code);
    const res = await orgApi.revokeInvite(code);
    setRevoking(null);
    if (res.data.error) notify(res.data.error);
    await load();
  }

  async function onCreateCorner() {
    if (newCorner.trim().length < 2 || cornerBusy) return;
    setCornerBusy(true);
    const res = await createCrew(newCorner.trim());
    setCornerBusy(false);
    if (res.upsell) return router.push('/paywall');
    if (res.error) return notify(res.error);
    setNewCorner('');
    await load();
  }

  if (!loaded) {
    return (
      <Screen>
        <ScreenHeader title="Organization" />
        <Caption>Loading…</Caption>
      </Screen>
    );
  }

  if (!org) {
    return (
      <Screen>
        <ScreenHeader title="Organization" />
        <Caption>You do not run an organization yet.</Caption>
        <Button label="See plans" onPress={() => router.push('/paywall')} />
      </Screen>
    );
  }

  const inactive = org.status !== 'active' && org.status !== 'trialing';

  return (
    <Screen>
      <ScreenHeader title="Organization" />

      {inactive && (
        <Nudge label="Plan" body="Your plan is inactive. Seats are not counting. Renew it in billing.">
          <Button label="Manage billing" onPress={onPortal} loading={portalBusy} />
        </Nudge>
      )}

      <Card>
        <Eyebrow>Seats</Eyebrow>
        <Mono>{`SEATS ${org.seats.used}/${org.seats.total}`}</Mono>
        {/* A quantity decrease in billing does not auto-unseat anyone; surface the overage. */}
        {org.seats.used > org.seats.total && (
          <Body color={color.actionText}>
            More people seated than seats paid. Release seats below, or add seats in billing.
          </Body>
        )}
        <Caption>Add or remove seats in billing.</Caption>
        <Button label="Manage billing" variant="secondary" onPress={onPortal} loading={portalBusy} />
      </Card>

      <Card>
        <Eyebrow>Crews</Eyebrow>
        {org.corners.map((c) => (
          <View key={c.id} style={styles.row}>
            <Body color={color.textPrimary} numberOfLines={1} style={styles.flexName}>
              {c.name}
            </Body>
            <Mono>{`${c.memberCount}/8`}</Mono>
            <Button
              label="Invite"
              variant="ghost"
              style={styles.smallBtn}
              onPress={() => onInvite(c.id)}
              loading={inviteBusy === c.id}
            />
          </View>
        ))}
        <Input inCard placeholder="New Crew name" value={newCorner} onChangeText={setNewCorner} />
        <Button
          label="Start a Crew"
          variant="secondary"
          onPress={onCreateCorner}
          loading={cornerBusy}
          disabled={newCorner.trim().length < 2}
        />
      </Card>

      <Card>
        <Eyebrow>People</Eyebrow>
        {org.members.length === 0 && <Caption>No one has joined yet. Share an invite code.</Caption>}
        {org.members.map((m) => (
          <View key={m.id} style={styles.row}>
            <View style={styles.memberBody}>
              <Body color={color.textPrimary} numberOfLines={1}>
                {m.name}
              </Body>
              <Caption numberOfLines={1}>{`@${m.username} · ${m.cornerName ?? 'unplaced'}`}</Caption>
            </View>
            <Chip
              label={m.seated ? 'Seated' : 'Seat'}
              active={m.seated}
              disabled={seatBusy !== null}
              onPress={() => void onSeat(m)}
            />
          </View>
        ))}
      </Card>

      <Card>
        <Eyebrow>Invites</Eyebrow>
        {org.invites.map((inv) => (
          <View key={inv.code} style={styles.row}>
            <Mono style={styles.flexName}>{inv.code}</Mono>
            <Caption>{inv.cornerName ?? 'no Crew'}</Caption>
            <Button
              label="Revoke"
              variant="ghost"
              style={styles.smallBtn}
              onPress={() => onRevoke(inv.code)}
              loading={revoking === inv.code}
            />
          </View>
        ))}
        <Button label="New invite code" variant="secondary" onPress={() => onInvite(null)} loading={inviteBusy === 'org'} />
        <Caption>Anyone with a code takes a seat when they join.</Caption>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  memberBody: { flex: 1, gap: 2 },
  flexName: { flex: 1 },
  smallBtn: { minHeight: 40, paddingHorizontal: space.md },
});
