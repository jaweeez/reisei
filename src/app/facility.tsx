import { useEffect, useState } from 'react';
import { Linking, Pressable, Share, StyleSheet, View } from 'react-native';
import { Body, Button, Caption, Card, Eyebrow, InlineNotice, Input, Mono, Screen, ScreenHeader, Section } from '@/components';
import { billingApi } from '@/lib/billing/client';
import { facilityOp, fetchFacility } from '@/lib/data/client';
import type { FacilityOverview } from '@/lib/data/types';
import { color, space } from '@/theme';

// Facility admin console (web-first). A facility funds Pro seats and hands out codes. It sees ONLY
// anonymous seat counts here — never who claimed a seat, never any activity. See
// docs/FACILITY_SPONSORSHIP.md. Buying seats is a web Stripe checkout (never App Store).

export default function Facility() {
  const [data, setData] = useState<FacilityOverview | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchFacility().then((next) => { if (active) setData(next); });
    return () => { active = false; };
  }, []);

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    const next = await facilityOp(body);
    setBusy(false);
    if (next) setData(next);
  }

  async function buySeats() {
    if (!data?.facility) return;
    setBusy(true);
    setErr(null);
    const res = await billingApi.checkout('facility', 'monthly', undefined, undefined, data.facility.id);
    setBusy(false);
    if (res.data.url) void Linking.openURL(res.data.url);
    else setErr(res.data.error ?? 'Could not open checkout. Seat billing is web-only.');
  }

  async function manageSeats() {
    setBusy(true);
    setErr(null);
    const res = await billingApi.portal();
    setBusy(false);
    if (res.data.url) void Linking.openURL(res.data.url);
    else setErr(res.data.error ?? 'Could not open billing management.');
  }

  if (!data) {
    return (
      <Screen>
        <ScreenHeader title="Facility" />
        <Caption>Loading…</Caption>
      </Screen>
    );
  }

  if (!data.facility) {
    return (
      <Screen>
        <ScreenHeader title="Facility" />
        <Caption>Sponsor private Pro for the people you serve. They claim a code and get the full app, privately. You see only seat counts, never who claimed one or what they log.</Caption>
        <Section label="Create your facility">
          <Input inCard placeholder="Facility name" value={name} onChangeText={setName} maxLength={120} />
          <Button label="Create facility" loading={busy} disabled={!name.trim()} onPress={() => run({ op: 'create', name })} />
        </Section>
      </Screen>
    );
  }

  const seats = data.seats ?? { total: 0, claimed: 0 };
  const codes = data.codes ?? [];

  return (
    <Screen>
      <ScreenHeader title={data.facility.name} />

      <InlineNotice label="Private by design" body="You see seat counts only. A claimed seat is anonymous: you never see who claimed it, their check-ins, log, or bearings. That is the point." />

      <Card>
        <Eyebrow>Seats</Eyebrow>
        {data.active ? (
          <Body color={color.textPrimary}>{`${seats.claimed} of ${seats.total} claimed`}</Body>
        ) : (
          <Body color={color.textPrimary}>No active plan yet. Add seats to start sponsoring.</Body>
        )}
        <Button
          label={data.active ? 'Manage seats' : 'Buy seats'}
          loading={busy}
          onPress={data.active ? manageSeats : buySeats}
        />
        {err && <Caption color={color.actionText}>{err}</Caption>}
      </Card>

      <Section label="Claim codes" action={{ label: 'New code', onPress: () => run({ op: 'code' }) }}>
        {codes.length ? (
          codes.map((c) => (
            <View key={c.code} style={styles.codeRow}>
              <Mono color={c.revoked ? color.textSecondary : color.textPrimary}>{c.revoked ? `${c.code} (off)` : c.code}</Mono>
              {c.revoked ? null : (
                <View style={styles.codeActions}>
                  <Pressable onPress={() => void Share.share({ message: `Claim your Reisei seat with code ${c.code}` })} hitSlop={8} accessibilityRole="button">
                    <Mono color={color.actionText}>Share</Mono>
                  </Pressable>
                  <Pressable onPress={() => run({ op: 'revoke', code: c.code })} hitSlop={8} accessibilityRole="button">
                    <Mono color={color.actionText}>Turn off</Mono>
                  </Pressable>
                </View>
              )}
            </View>
          ))
        ) : (
          <Caption>No codes yet. Make one and share it with the people you sponsor.</Caption>
        )}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  codeActions: { flexDirection: 'row', gap: space.lg },
});
