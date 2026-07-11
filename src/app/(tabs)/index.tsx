import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Body, Button, Caption, Card, Chip, CrewDots, Display, Eyebrow, Input, Mono, Nudge, Screen, Title, VialMark } from '@/components';
import { checkIn, createLine, fetchState, planRecovery } from '@/lib/data/client';
import { confirm } from '@/lib/alerts';
import { useAuth } from '@/lib/auth/AuthProvider';
import {
  RECOVERY_FRICTION_LABEL,
  RECOVERY_FRICTIONS,
  RECOVERY_MOVES,
  type HomeState,
  type LineKind,
  type RecoveryFriction,
} from '@/lib/data/types';
import { color, space } from '@/theme';

export default function Today() {
  const { user } = useAuth();
  const [state, setState] = useState<HomeState | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [friction, setFriction] = useState<RecoveryFriction | null>(null);
  const [move, setMove] = useState('');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
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
      const ok = await confirm('Log a break?', 'Your streak resets to zero. Your integrity count stays.', 'Log it');
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

  async function onPlanRecovery() {
    if (!friction || !move) {
      setRecoveryError('Name what got in the way, then choose one move.');
      return;
    }
    setBusy(true);
    setRecoveryError(null);
    const res = await planRecovery(friction, move);
    setBusy(false);
    if (res.plan) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setFriction(null);
      setMove('');
      await load();
    } else {
      setRecoveryError(res.error ?? 'Could not set tomorrow\'s move.');
    }
  }

  if (!state) {
    return (
      <Screen>
        <Caption>Loading…</Caption>
      </Screen>
    );
  }

  // ── Empty state: draw your line ──
  if (!state.line) {
    return (
      <Screen>
        <View style={styles.head}>
          <VialMark width={150} />
          <Title style={{ marginTop: space.lg }}>Draw your line</Title>
        </View>
        <Card>
          <Body>One standard you hold yourself to. An honest slip beats going quiet, so log it. Your Corner respects the report.</Body>
          <Input
            inCard
            placeholder='e.g. "In bed by 23:00" · "No drinking"'
            value={statement}
            onChangeText={setStatement}
            maxLength={80}
          />
          <View style={styles.kindRow}>
            <Chip label="A line I won't cross" active={kind === 'abstain'} onPress={() => setKind('abstain')} style={{ flex: 1 }} />
            <Chip label="A bar I'll hold" active={kind === 'hold'} onPress={() => setKind('hold')} style={{ flex: 1 }} />
          </View>
          {error && <Body color={color.actionText}>{error}</Body>}
          <Button label="Draw the line" onPress={onDraw} loading={busy} disabled={statement.trim().length < 2} />
        </Card>
      </Screen>
    );
  }

  const line = state.line;
  const s = state.streak;
  const verdict = state.todayVerdict ?? null;
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
      {state.todayNudge && <Nudge label="Coach" body={state.todayNudge} />}
      {state.recovery.carry && (
        <Nudge
          label="Your move today"
          body={`${RECOVERY_FRICTION_LABEL[state.recovery.carry.friction]}. ${state.recovery.carry.move}.`}
        />
      )}

      <Card>
        <Eyebrow>Your line</Eyebrow>
        <Display>{line?.statement ?? ''}</Display>
        {s && (
          <Mono>
            {`STREAK ${String(s.current).padStart(2, '0')} · BEST ${String(s.longest).padStart(2, '0')} · BROKE ${String(
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
            <Input
              inCard
              placeholder="How did today actually go?"
              value={note}
              onChangeText={setNote}
              maxLength={140}
            />
            <Button label="Held it" onPress={() => onLog('held')} loading={busy} />
            <Button label="It slipped" variant="ghost" onPress={() => onLog('broke')} />
          </>
        ) : (
          <Mono>{`LOGGED TODAY · ${verdict.toUpperCase()}`}</Mono>
        )}
      </Card>

      {verdict === 'broke' && (
        state.recovery.today ? (
          <Card>
            <Eyebrow>Tomorrow's move</Eyebrow>
            <Body color={color.textPrimary}>{state.recovery.today.move}</Body>
            <Caption>{`${RECOVERY_FRICTION_LABEL[state.recovery.today.friction]}. Set for tomorrow.`}</Caption>
          </Card>
        ) : (
          <Card>
            <Eyebrow>Turn the miss</Eyebrow>
            <Body>What got in the way?</Body>
            <View style={styles.chipGrid}>
              {RECOVERY_FRICTIONS.map((value) => (
                <Chip
                  key={value}
                  label={RECOVERY_FRICTION_LABEL[value]}
                  active={friction === value}
                  onPress={() => setFriction(value)}
                  style={styles.chipHalf}
                />
              ))}
            </View>
            <Body>What is your move tomorrow?</Body>
            <View style={styles.chipGrid}>
              {RECOVERY_MOVES.map((option) => (
                <Chip key={option} label={option} active={move === option} onPress={() => setMove(option)} style={styles.chipHalf} />
              ))}
            </View>
            {recoveryError && <Body color={color.actionText}>{recoveryError}</Body>}
            <Button label="Set tomorrow's move" onPress={onPlanRecovery} loading={busy} disabled={!friction || !move} />
          </Card>
        )
      )}

      {verdict === 'broke' && (
        <Nudge label="The log" body="Rough one today. Put words to it. Private, just for you." onPress={() => router.push('/log')} />
      )}

      {user && !user.emailRequired && !user.emailVerified && (
        <Nudge label="Account" body="Add an email so you can recover your account." onPress={() => router.push('/verify-email')} />
      )}

      <Nudge variant="quiet" label="Today's bearing" onPress={() => router.push('/bearing')}>
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
      </Nudge>

      <Button
        label={state.resetToday ? 'Reset · run it again' : 'Reset · 60s to level'}
        variant="secondary"
        onPress={() => router.push('/reset')}
      />

      {state.crews.length > 0 ? (
        state.crews.map((crew) => (
          <Card key={crew.id}>
            <View style={styles.crewHead}>
              <Body color={color.textPrimary} numberOfLines={1} style={{ flex: 1, marginRight: space.sm }}>
                {crew.name}
              </Body>
              <Mono>{`HELD ${crew.heldCount}/${crew.memberCount}${crew.brokeCount ? ` · ${crew.brokeCount} BROKE` : ''}`}</Mono>
            </View>
            <CrewDots members={crew.members} />
          </Card>
        ))
      ) : (
        <Card>
          <Eyebrow>Your Corner</Eyebrow>
          <Caption>No Corner yet. Join one, or go Pro to lead your own. You hold your line in front of people who know what you committed to.</Caption>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', marginTop: space.section },
  mark: { alignItems: 'center', paddingVertical: space.md },
  crewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kindRow: { flexDirection: 'row', gap: space.sm },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chipHalf: { flexGrow: 1, flexBasis: '46%' },
});
