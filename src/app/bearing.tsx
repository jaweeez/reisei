import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Body, Button, Caption, Card, Eyebrow, Mono, Screen, Text, Title } from '@/components';
import { fetchBearing, fetchBearingHistory, logBearing, setSchools } from '@/lib/data/client';
import type { BearingHistory, BearingResponse, BearingView } from '@/lib/data/types';
import { color, radius, space } from '@/theme';

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

  const load = useCallback(async () => setData(await fetchBearing()), []);
  useEffect(() => {
    void load();
  }, [load]);

  const followedCount = data?.schools.filter((s) => s.followed).length ?? 0;

  async function toggle(ideology: string) {
    if (!data) return;
    const followed = data.schools.filter((s) => s.followed).map((s) => s.ideology);
    const next = followed.includes(ideology) ? followed.filter((x) => x !== ideology) : [...followed, ideology];
    setBusy(true);
    const res = await setSchools(next);
    if (res.upsell) {
      setBusy(false);
      router.push('/paywall');
      return;
    }
    void Haptics.selectionAsync();
    await load(); // regenerate today's bearings for the new set
    setBusy(false);
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

  return (
    <Screen>
      <View style={styles.header}>
        <Title>The Bearing</Title>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Mono>Close</Mono>
        </Pressable>
      </View>
      <Caption>A principle to steer by, from the schools you follow. Direction, not mood.</Caption>

      {/* School picker */}
      <Card>
        <Eyebrow>Your schools</Eyebrow>
        {followedCount === 0 && (
          <Caption>Choose the schools you draw from. Each gives you one daily principle, grounded and sourced.</Caption>
        )}
        <View style={styles.chips}>
          {data?.schools.map((s) => (
            <Pressable
              key={s.ideology}
              onPress={() => toggle(s.ideology)}
              disabled={busy}
              style={[styles.chip, s.followed && styles.chipActive]}
            >
              <Text variant="mono" color={s.followed ? color.bg : color.textBody}>
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {followedCount > 0 && <Caption>Free follows up to 2 schools. Pro follows as many as you want.</Caption>}
      </Card>

      {/* Today's bearings */}
      {data?.today.map((b) => (
        <Card key={b.bearingId}>
          <Eyebrow>{b.label}</Eyebrow>
          <Body color={color.textPrimary} style={styles.principle}>
            {b.principle}
          </Body>
          {b.prompt ? <Body color={color.textBody}>{b.prompt}</Body> : null}

          <Pressable onPress={() => void Linking.openURL(b.source.url)} hitSlop={8} style={styles.sourceRow}>
            <Mono color={color.actionText}>Open the source →</Mono>
          </Pressable>
          <Caption>{b.source.attribution}</Caption>
          <Caption>{b.copyright}</Caption>

          {b.loggedToday ? (
            <Mono>Logged today</Mono>
          ) : (
            <>
              <TextInput
                placeholder="Log your read. What it means for today…"
                placeholderTextColor={color.textSecondary}
                value={notes[b.bearingId] ?? ''}
                onChangeText={(t) => setNotes((n) => ({ ...n, [b.bearingId]: t }))}
                maxLength={400}
                multiline
                style={styles.input}
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
      ))}

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
                  <Button label="Go Pro" variant="secondary" onPress={() => router.push('/paywall')} />
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.rule,
  },
  chipActive: { backgroundColor: color.action, borderColor: color.action },
  principle: { fontSize: 18, lineHeight: 26 },
  sourceRow: { paddingVertical: space.xs },
  logList: { gap: space.lg },
  input: {
    minHeight: 72,
    backgroundColor: color.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.rule,
    padding: space.lg,
    color: color.textPrimary,
    fontFamily: 'IBMPlexSans_400Regular',
    fontSize: 16,
    textAlignVertical: 'top',
  },
});
