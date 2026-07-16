import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Body, Button, Caption, Card, Chip, Eyebrow, InlineNotice, Input, Mono, Screen, ScreenHeader, Section, Text } from '@/components';
import { acknowledgeRecoveryTerms, fetchBearing, fetchBearingHistory, logBearing, setSchools } from '@/lib/data/client';
import type { BearingHistory, BearingResponse, BearingView } from '@/lib/data/types';
import { FAMILY_LABEL, FAMILY_ORDER } from '@/data/corpus/types';
import { color, space } from '@/theme';

// The Bearing — a daily operating principle to steer by, from the schools you follow.
// Reisei's own wording, grounded in each school, with a link out to the source. Log a
// private response (never shown to the crew). "Direction, not mood."

export default function Bearing() {
  const [data, setData] = useState<BearingResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [history, setHistory] = useState<BearingHistory | null>(null);
  const [ackPending, setAckPending] = useState<string | null>(null);

  const load = useCallback(async () => setData(await fetchBearing()), []);
  useEffect(() => {
    let active = true;
    void fetchBearing().then((next) => { if (active) setData(next); });
    return () => { active = false; };
  }, []);

  async function toggle(ideology: string, skipAck = false) {
    if (!data) return;
    // First time following a Recovery school: show the not-treatment acknowledgment once.
    const school = data.schools.find((s) => s.ideology === ideology);
    const turningOn = school && !school.followed;
    if (!skipAck && turningOn && school?.family === 'recovery' && !data.recoveryAck) {
      setAckPending(ideology);
      return;
    }
    const followed = data.schools.filter((s) => s.followed).map((s) => s.ideology);
    const next = followed.includes(ideology) ? followed.filter((x) => x !== ideology) : [...followed, ideology];
    setBusy(true);
    const res = await setSchools(next);
    if (res.upsell) {
      setBusy(false);
      router.push('/paywall');
      return;
    }
    await load(); // regenerate today's bearings for the new set
    setBusy(false);
  }

  async function confirmAck() {
    setBusy(true);
    const ok = await acknowledgeRecoveryTerms();
    setBusy(false);
    if (!ok) return;
    const pending = ackPending;
    setData((d) => (d ? { ...d, recoveryAck: true } : d));
    setAckPending(null);
    if (pending) await toggle(pending, true);
  }

  async function onLog(b: BearingView) {
    const note = (notes[b.bearingId] ?? '').trim();
    if (!note) return;
    setLoggingId(b.bearingId);
    const ok = await logBearing(b.bearingId, note);
    setLoggingId(null);
    if (ok) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNotes((n) => ({ ...n, [b.bearingId]: '' }));
      await load();
    }
  }

  async function openLog() {
    const next = !showLog;
    setShowLog(next);
    if (next && !history) setHistory(await fetchBearingHistory());
  }

  if (!data) {
    return (
      <Screen>
        <ScreenHeader title="The Bearing" />
        <Caption>Loading…</Caption>
      </Screen>
    );
  }

  const followedCount = data.schools.filter((s) => s.followed).length;

  const picker = (
    <View style={styles.picker}>
      {followedCount === 0 && (
        <Caption>Choose the schools you draw from. Each gives you one daily principle, grounded and sourced.</Caption>
      )}
      {FAMILY_ORDER.map((family) => {
        const inFamily = data.schools.filter((s) => s.family === family);
        if (!inFamily.length) return null;
        return (
          <Section key={family} label={FAMILY_LABEL[family]}>
            {family === 'recovery' && (
              <InlineNotice
                label="Not treatment"
                body="Reisei is not treatment, a sponsor, or a meeting. It sits alongside them. In a crisis, reach a real person: call or text 988, or SAMHSA at 1-800-662-4357."
              />
            )}
            <View style={styles.chips}>
              {inFamily.map((s) => (
                <Chip key={s.ideology} label={s.label} active={s.followed} onPress={() => toggle(s.ideology)} disabled={busy} />
              ))}
            </View>
          </Section>
        );
      })}
      {followedCount > 0 && <Caption>Free follows up to 2 schools. Pro follows as many as you want.</Caption>}
    </View>
  );

  const todayCards = data.today.map((b) => (
    <Card key={b.bearingId}>
      <Eyebrow>{b.label}</Eyebrow>
      {b.quote ? (
        <View style={styles.quoteBlock}>
          <Text variant="quote">{`“${b.quote.text}”`}</Text>
          <Mono color={color.textSecondary}>{b.quote.ref}</Mono>
        </View>
      ) : null}
      <Body color={color.textBody}>{b.principle}</Body>
      {b.prompt ? <Body color={color.textBody}>{b.prompt}</Body> : null}

      <Pressable
        onPress={() => void Linking.openURL(b.source.url)}
        hitSlop={8}
        accessibilityRole="link"
        style={styles.sourceRow}
      >
        <Mono color={color.actionText}>{b.quote ? 'Read it in context →' : 'Open the source →'}</Mono>
      </Pressable>
      <Caption>{b.source.attribution}</Caption>
      <Caption>{b.copyright}</Caption>

      {b.loggedToday ? (
        <Mono>Logged today</Mono>
      ) : (
        <>
          <Input
            inCard
            multiline
            placeholder="Log your read. What it means for today…"
            value={notes[b.bearingId] ?? ''}
            onChangeText={(t) => setNotes((n) => ({ ...n, [b.bearingId]: t }))}
            maxLength={400}
          />
          <Button
            label="Log it"
            onPress={() => onLog(b)}
            loading={loggingId === b.bearingId}
            disabled={!(notes[b.bearingId] ?? '').trim()}
          />
        </>
      )}
    </Card>
  ));

  return (
    <Screen>
      <ScreenHeader title="The Bearing" />
      <Caption>A principle to steer by, from the schools you follow. Direction, not mood.</Caption>

      {ackPending && (
        <Card>
          <Eyebrow>Before you start</Eyebrow>
          <Body color={color.textBody}>Reisei is not treatment, a sponsor, or a meeting. It sits alongside them. In a crisis, reach a real person: call or text 988, or SAMHSA at 1-800-662-4357.</Body>
          <Button label="I understand" onPress={confirmAck} loading={busy} />
          <Button label="Not now" variant="ghost" onPress={() => setAckPending(null)} />
        </Card>
      )}

      {/* Return visits lead with today's bearing; first-run leads with the picker. */}
      {followedCount > 0 ? (
        <>
          {todayCards}
          {picker}
        </>
      ) : (
        <>
          {picker}
          {todayCards}
        </>
      )}

      {followedCount > 0 && (
        <>
          <Button label={showLog ? 'Hide your log' : 'Your log'} variant="ghost" onPress={openLog} />
          {showLog && (
            <View style={styles.logList}>
              {history?.logs.length ? (
                history.logs.map((item, i) => (
                  <Card key={`${item.date}-${i}`}>
                    <Mono>{`${item.date} · ${item.label}`}</Mono>
                    {item.principle ? <Caption>{item.principle}</Caption> : null}
                    <Body color={color.textPrimary}>{item.note}</Body>
                  </Card>
                ))
              ) : (
                <Caption>No entries yet. Log a read above and it lands here.</Caption>
              )}
              {history?.upsell && (
                <Card>
                  <Eyebrow>Pro</Eyebrow>
                  <Caption>You have entries older than 30 days. Go Pro to keep the full log.</Caption>
                  <Button label="Go Pro" onPress={() => router.push('/paywall')} />
                </Card>
              )}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  picker: { gap: space.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  quoteBlock: { gap: space.xs, paddingLeft: space.md, borderLeftWidth: 2, borderLeftColor: color.action },
  sourceRow: { paddingVertical: space.xs },
  logList: { gap: space.lg },
});
