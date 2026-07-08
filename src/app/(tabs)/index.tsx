import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Body, Button, Caption, Card, CrewDots, Display, Eyebrow, Mono, Screen, Text, Title, VialMark } from '@/components';
import { checkIn, createLine, fetchState } from '@/lib/data/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import type { HomeState, LineKind } from '@/lib/data/types';
import { color, radius, space } from '@/theme';

export default function Today() {
  const { user } = useAuth();
  const [state, setState] = useState<HomeState | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  // draw-a-line form
  const [statement, setStatement] = useState('');
  const [kind, setKind] = useState<LineKind>('abstain');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => setState(await fetchState()), []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onDraw() {
    if (statement.trim().length < 2) return;
    setBusy(true);
    setError(null);
    const res = await createLine(statement.trim(), kind);
    setBusy(false);
    if (res.line) {
      setStatement('');
      await load();
    } else {
      setError(res.error ?? 'Could not draw the line.');
    }
  }

  async function onLog(verdict: 'held' | 'broke') {
    if (verdict === 'broke') {
      const ok = await confirmBreak();
      if (!ok) return;
    }
    setBusy(true);
    const res = await checkIn(verdict, note.trim() || undefined);
    setBusy(false);
    if (res) {
      void Haptics.notificationAsync(
        verdict === 'held' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
      );
      setNote('');
      await load();
    }
  }

  // ── Empty state: draw your line ──
  if (state && !state.line) {
    return (
      <Screen>
        <View style={styles.head}>
          <VialMark width={150} />
          <Title style={{ marginTop: space.lg }}>Draw your line</Title>
        </View>
        <Card>
          <Caption>One standard you hold yourself to. An honest slip beats going quiet, so log it. Your Corner respects the report.</Caption>
          <TextInput
            placeholder='e.g. "In bed by 23:00" · "No drinking"'
            placeholderTextColor={color.textSecondary}
            value={statement}
            onChangeText={setStatement}
            maxLength={80}
            style={styles.input}
          />
          <View style={styles.kindRow}>
            <KindChip label="A line I won't cross" active={kind === 'abstain'} onPress={() => setKind('abstain')} />
            <KindChip label="A bar I'll hold" active={kind === 'hold'} onPress={() => setKind('hold')} />
          </View>
          {error && <Body color={color.actionText}>{error}</Body>}
          <Button label="Draw the line" onPress={onDraw} loading={busy} disabled={statement.trim().length < 2} />
        </Card>
      </Screen>
    );
  }

  const line = state?.line;
  const s = state?.streak;
  const verdict = state?.todayVerdict ?? null;
  const message =
    verdict === 'held'
      ? 'Logged. You showed up today.'
      : verdict === 'broke'
        ? 'You logged it honestly. That counts.'
        : s && s.current > 0
          ? `${s.current}-day streak. One day at a time.`
          : s && s.lastVerdict === 'broke'
            ? 'It slipped last time. Today is a fresh read. Check in.'
            : 'Check in when you are ready.';

  return (
    <Screen>
      {state?.todayNudge && (
        <View style={styles.banner}>
          <Mono color={color.actionText}>Coach</Mono>
          <Body color={color.textPrimary}>{state.todayNudge}</Body>
        </View>
      )}

      {user && !user.emailRequired && !user.emailVerified && (
        <Pressable style={styles.banner} onPress={() => router.push('/verify-email')}>
          <Mono color={color.actionText}>Account</Mono>
          <Body color={color.textPrimary}>Add an email so you can recover your account.</Body>
        </Pressable>
      )}

      <Card>
        <Eyebrow>Your line</Eyebrow>
        <Display>{line?.statement ?? ''}</Display>
        {s && (
          <Mono>
            {`STREAK ${String(s.current).padStart(2, '0')} · LONGEST ${String(s.longest).padStart(2, '0')} · BROKE ${String(
              s.breaks,
            ).padStart(2, '0')} · INTEGRITY ${String(s.integrity).padStart(2, '0')}`}
          </Mono>
        )}

        <View style={styles.mark}>
          <VialMark width={200} off={verdict === 'broke' ? 42 : 0} />
        </View>

        <Body>{message}</Body>

        {verdict === null ? (
          <>
            <TextInput
              placeholder="How did today actually go?"
              placeholderTextColor={color.textSecondary}
              value={note}
              onChangeText={setNote}
              maxLength={140}
              style={styles.input}
            />
            <Button label="Held it" onPress={() => onLog('held')} loading={busy} />
            <Button label="It slipped" variant="ghost" onPress={() => onLog('broke')} />
          </>
        ) : (
          <Mono>{`LOGGED TODAY · ${verdict.toUpperCase()}`}</Mono>
        )}
      </Card>

      {state && (
        <Pressable style={styles.bearing} onPress={() => router.push('/bearing')}>
          <Mono color={color.actionText}>Today's bearing</Mono>
          {!state.bearing ? (
            <Body color={color.textPrimary}>Set your bearing →</Body>
          ) : state.bearing.principle ? (
            <>
              <Body color={color.textPrimary}>{state.bearing.principle}</Body>
              <Mono>{`${state.bearing.label}${state.bearing.loggedToday ? ' · LOGGED' : ''}`}</Mono>
            </>
          ) : (
            <Body color={color.textPrimary}>{`Open today's bearing · ${state.bearing.label} →`}</Body>
          )}
        </Pressable>
      )}

      <Button
        label={state?.resetToday ? 'Reset · run it again' : 'Reset · 60s to level'}
        variant="ghost"
        onPress={() => router.push('/reset')}
      />

      {state && state.crews.length > 0 ? (
        state.crews.map((crew) => (
          <Card key={crew.id}>
            <View style={styles.crewHead}>
              <Body color={color.textPrimary}>{crew.name}</Body>
              <Mono>{`HELD ${crew.heldCount}/${crew.memberCount}${crew.brokeCount ? ` · ${crew.brokeCount} BROKE` : ''}`}</Mono>
            </View>
            <CrewDots members={crew.members} />
          </Card>
        ))
      ) : (
        <Caption>No Corner yet. Join one, or go Pro to lead your own. You hold your line in front of people who know what you committed to.</Caption>
      )}
    </Screen>
  );
}

function KindChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text variant="caption" color={active ? color.bg : color.textBody}>
        {label}
      </Text>
    </Pressable>
  );
}

function confirmBreak(): Promise<boolean> {
  const msg = 'Log a break? Your streak resets to zero. Your integrity count stays.';
  if (Platform.OS === 'web') return Promise.resolve(typeof window !== 'undefined' ? window.confirm(msg) : true);
  return new Promise((res) =>
    Alert.alert('Log a break?', msg, [
      { text: 'Cancel', style: 'cancel', onPress: () => res(false) },
      { text: 'Log it', style: 'destructive', onPress: () => res(true) },
    ]),
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', marginTop: space.section },
  banner: { gap: space.xs, padding: space.lg, borderRadius: radius.md, borderLeftWidth: 3, borderLeftColor: color.action, backgroundColor: color.actionSoft },
  bearing: { gap: space.xs, padding: space.lg, borderRadius: radius.md, borderWidth: 1, borderColor: color.rule, backgroundColor: color.card },
  mark: { alignItems: 'center', paddingVertical: space.md },
  crewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
  kindRow: { flexDirection: 'row', gap: space.sm },
  chip: {
    flex: 1,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.rule,
    alignItems: 'center',
  },
  chipActive: { backgroundColor: color.action, borderColor: color.action },
});
