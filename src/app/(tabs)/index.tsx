import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  ActionDock,
  Body,
  Button,
  Caption,
  Chip,
  CrewDots,
  Display,
  EmptyState,
  Eyebrow,
  HeroPanel,
  InlineNotice,
  Input,
  IntegrityAgreement,
  ListRow,
  Mono,
  PageHeader,
  Screen,
  Section,
  StatusPill,
  VialMark,
} from '@/components';
import { checkIn, createLine, fetchState, planRecovery, updateAccountability } from '@/lib/data/client';
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
import { color, radius, space } from '@/theme';

export default function Today() {
  const { user } = useAuth();
  const [state, setState] = useState<HomeState | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [friction, setFriction] = useState<RecoveryFriction | null>(null);
  const [move, setMove] = useState('');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [statement, setStatement] = useState('');
  const [kind, setKind] = useState<LineKind>('abstain');
  const [honestyAccepted, setHonestyAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const next = await fetchState();
    setState(next);
    if (next?.accountability.honestyAcknowledged) setHonestyAccepted(true);
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));

  async function onDraw() {
    if (statement.trim().length < 2 || !honestyAccepted) return;
    setBusy(true);
    setError(null);
    const res = await createLine(statement.trim(), kind, honestyAccepted);
    setBusy(false);
    if (res.line) {
      setStatement('');
      await load();
    } else setError(res.error ?? 'Could not draw the Line.');
  }

  async function acceptExistingAgreement() {
    setBusy(true);
    const result = await updateAccountability({ honestyAccepted: true });
    setBusy(false);
    if (result.honestyAcknowledged) await load();
  }

  async function onLog(verdict: 'held' | 'broke') {
    if (verdict === 'broke') {
      const ok = await confirm('Log a break?', 'Your streak resets to zero. Your integrity count stays.', 'Log it');
      if (!ok) return;
    }
    setBusy(true);
    const res = await checkIn(verdict, note.trim() || undefined);
    setBusy(false);
    if (!res) return;
    void Haptics.notificationAsync(
      verdict === 'held' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
    );
    setNote('');
    await load();
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
    } else setRecoveryError(res.error ?? 'Could not set tomorrow\'s move.');
  }

  if (!state) return <Screen><Caption>Loading…</Caption></Screen>;

  if (!state.line) {
    return (
      <Screen>
        <PageHeader title="Today" context={state.localDate} />
        <EmptyState
          title="Draw your Line"
          body="Choose one standard for the next fourteen days. Make it clear enough that you know whether you held it."
        />
        <HeroPanel>
          <Input
            inCard
            placeholder='e.g. "In bed by 23:00" or "No drinking"'
            value={statement}
            onChangeText={setStatement}
            maxLength={80}
          />
          <View style={styles.kindRow}>
            <Chip label="A Line I won't cross" active={kind === 'abstain'} onPress={() => setKind('abstain')} style={styles.grow} />
            <Chip label="A bar I'll hold" active={kind === 'hold'} onPress={() => setKind('hold')} style={styles.grow} />
          </View>
          {!state.accountability.honestyAcknowledged ? (
            <IntegrityAgreement accepted={honestyAccepted} onChange={setHonestyAccepted} />
          ) : null}
          {error ? <Body color={color.actionText}>{error}</Body> : null}
          <Button label="Start the 14-day Cycle" onPress={onDraw} loading={busy} disabled={statement.trim().length < 2 || !honestyAccepted} />
        </HeroPanel>
      </Screen>
    );
  }

  const { line, cycle } = state;
  const s = state.streak;
  const verdict = state.todayVerdict;
  const message = verdict === 'held'
    ? 'Logged. You showed up today.'
    : verdict === 'broke'
      ? 'You logged it honestly. That counts.'
      : s.current > 0
        ? `${s.current}-day streak. One day at a time.`
        : s.lastVerdict === 'broke'
          ? 'It slipped last time. Today is a fresh read.'
          : 'Give today an honest read.';

  return (
    <Screen>
      <PageHeader
        title="Today"
        context={cycle ? `Day ${cycle.day} of 14 · ${state.localDate}` : state.localDate}
        action={{ label: 'Ledger', onPress: () => router.push('/ledger') }}
      />

      {!state.accountability.honestyAcknowledged ? (
        <InlineNotice
          label="Integrity"
          body="Reisei only works when the report is honest. Tap to accept the honesty agreement."
          onPress={acceptExistingAgreement}
        />
      ) : null}
      {cycle?.reviewDue ? (
        <InlineNotice label="Line Review due" body="Fourteen days are complete. Read the Cycle honestly and decide what comes next." onPress={() => router.push('/line-review')} />
      ) : null}
      {state.todayNudge ? <InlineNotice label="Coach" body={state.todayNudge} /> : null}
      {state.recovery.carry ? (
        <InlineNotice label="Your move today" body={`${RECOVERY_FRICTION_LABEL[state.recovery.carry.friction]}. ${state.recovery.carry.move}.`} />
      ) : null}

      <HeroPanel>
        <View style={styles.heroHead}>
          <Eyebrow>Your Line</Eyebrow>
          <StatusPill
            label={verdict === 'held' ? 'Held' : verdict === 'broke' ? 'Honest break' : cycle?.reviewDue ? 'Review due' : 'Open'}
            tone={verdict === 'held' ? 'held' : verdict === 'broke' ? 'broke' : cycle?.reviewDue ? 'review' : 'quiet'}
          />
        </View>
        <Display>{line.statement}</Display>
        <Mono>{`STREAK ${String(s.current).padStart(2, '0')} · BEST ${String(s.longest).padStart(2, '0')} · INTEGRITY ${String(s.integrity).padStart(2, '0')}`}</Mono>
        <View style={styles.mark}><VialMark width={184} off={verdict === 'broke' ? 42 : 0} /></View>
        <Body>{message}</Body>

        {verdict === null ? (
          <>
            <Input inCard placeholder="How did today actually go?" value={note} onChangeText={setNote} maxLength={140} />
            <ActionDock reminder="Tell the truth. That is the work.">
              <Button label="Held it" onPress={() => onLog('held')} loading={busy} />
              <Button label="It slipped" variant="ghost" onPress={() => onLog('broke')} disabled={busy} />
            </ActionDock>
          </>
        ) : (
          <Mono>{`LOGGED TODAY · ${verdict.toUpperCase()}`}</Mono>
        )}
        <Button label={cycle?.reviewDue ? 'Complete Line Review' : 'Review or change Line'} variant="ghost" onPress={() => router.push('/line-review')} />
      </HeroPanel>

      {verdict === 'broke' ? (
        <Section label="Recovery">
          {state.recovery.today ? (
            <InlineNotice label="Tomorrow's move" body={`${state.recovery.today.move}. ${RECOVERY_FRICTION_LABEL[state.recovery.today.friction]}.`} />
          ) : (
            <View style={styles.stack}>
              <Body>What got in the way?</Body>
              <View style={styles.chipGrid}>
                {RECOVERY_FRICTIONS.map((value) => (
                  <Chip key={value} label={RECOVERY_FRICTION_LABEL[value]} active={friction === value} onPress={() => setFriction(value)} style={styles.chipHalf} />
                ))}
              </View>
              <Body>What is your move tomorrow?</Body>
              <View style={styles.chipGrid}>
                {RECOVERY_MOVES.map((option) => (
                  <Chip key={option} label={option} active={move === option} onPress={() => setMove(option)} style={styles.chipHalf} />
                ))}
              </View>
              {recoveryError ? <Body color={color.actionText}>{recoveryError}</Body> : null}
              <Button label="Set tomorrow's move" onPress={onPlanRecovery} loading={busy} disabled={!friction || !move} />
            </View>
          )}
        </Section>
      ) : null}

      <Section label="Tools">
        <View style={styles.tools}>
          <Tool label="Bearing" detail={state.bearing?.label ?? 'Choose a school'} onPress={() => router.push('/bearing')} />
          <Tool label="Reset" detail={state.resetToday ? 'Done today' : '60s to level'} onPress={() => router.push('/reset')} />
          <Tool label="Log" detail="Private" onPress={() => router.push('/log')} />
        </View>
      </Section>

      <Section label="Crew" action={{ label: 'Open', onPress: () => router.push('/crew') }}>
        {state.crews.length ? state.crews.map((crew) => (
          <ListRow
            key={crew.id}
            title={crew.name}
            detail={`${crew.heldCount} held · ${crew.brokeCount} honest breaks · ${crew.memberCount} people`}
            trailing={<CrewDots members={crew.members} />}
            onPress={() => router.push('/crew')}
          />
        )) : (
          <Caption>No Crew yet. Pro covers you and two invited people.</Caption>
        )}
      </Section>

      {user && !user.emailRequired && !user.emailVerified ? (
        <InlineNotice label="Account" body="Add an email so you can recover your account." onPress={() => router.push('/verify-email')} />
      ) : null}
    </Screen>
  );
}

function Tool({ label, detail, onPress }: { label: string; detail: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tool, pressed && styles.pressed]} accessibilityRole="button">
      <Eyebrow>{label}</Eyebrow>
      <Caption>{detail}</Caption>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  kindRow: { flexDirection: 'row', gap: space.sm },
  heroHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  mark: { alignItems: 'center', paddingVertical: space.sm },
  stack: { gap: space.md },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chipHalf: { flexGrow: 1, flexBasis: '46%' },
  tools: { flexDirection: 'row', gap: space.sm },
  tool: { flex: 1, minHeight: 88, borderWidth: 1, borderColor: color.rule, borderRadius: radius.md, padding: space.md, justifyContent: 'space-between' },
  pressed: { opacity: 0.78 },
});
