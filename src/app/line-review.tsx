import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Body,
  Button,
  Caption,
  Chip,
  HeroPanel,
  Input,
  Mono,
  Screen,
  ScreenHeader,
  Section,
} from '@/components';
import { fetchState, reviewLine } from '@/lib/data/client';
import {
  EARLY_CHANGE_REASON_LABEL,
  type EarlyChangeReason,
  type HomeState,
  type LineKind,
  type LineReviewAction,
} from '@/lib/data/types';
import { color, space } from '@/theme';

const ACTIONS: { value: LineReviewAction; label: string; detail: string }[] = [
  { value: 'keep', label: 'Keep it', detail: 'Run the same Line for another Cycle.' },
  { value: 'refine', label: 'Refine it', detail: 'Make the Line clearer or more realistic.' },
  { value: 'raise', label: 'Raise it', detail: 'Choose a more demanding version.' },
  { value: 'replace', label: 'Replace it', detail: 'Start a different Line.' },
  { value: 'retire', label: 'Retire it', detail: 'Close the Line without drawing another yet.' },
];

export default function LineReviewScreen() {
  const [state, setState] = useState<HomeState | null>(null);
  const [action, setAction] = useState<LineReviewAction | null>(null);
  const [earlyReason, setEarlyReason] = useState<EarlyChangeReason | null>(null);
  const [statement, setStatement] = useState('');
  const [kind, setKind] = useState<LineKind>('abstain');
  const [easier, setEasier] = useState('');
  const [friction, setFriction] = useState('');
  const [nextStandard, setNextStandard] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchState().then((next) => {
      setState(next);
      if (next?.line) {
        setStatement(next.line.statement);
        setKind(next.line.kind);
      }
    });
  }, []);

  if (!state) return <Screen><ScreenHeader title="Line Review" /><Caption>Loading…</Caption></Screen>;
  if (!state.line || !state.cycle) {
    return (
      <Screen>
        <ScreenHeader title="Line Review" />
        <HeroPanel><Body>No active Line to review.</Body><Button label="Back to Today" onPress={() => router.replace('/')} /></HeroPanel>
      </Screen>
    );
  }

  const due = state.cycle.reviewDue;
  const changesStatement = action === 'refine' || action === 'raise' || action === 'replace';
  const canSubmit = !!action && (due || !!earlyReason) && (!changesStatement || statement.trim().length >= 2);

  async function submit() {
    if (!action || !canSubmit) return;
    setBusy(true);
    setError(null);
    const result = await reviewLine({
      action,
      statement: changesStatement ? statement.trim() : undefined,
      kind: changesStatement ? kind : undefined,
      easier,
      friction,
      nextStandard,
      earlyReason: earlyReason ?? undefined,
    });
    setBusy(false);
    if (result.ok) router.replace('/');
    else setError(result.error ?? 'Could not complete the review.');
  }

  return (
    <Screen>
      <ScreenHeader title="Line Review" />
      <HeroPanel>
        <Mono>{`DAY ${state.cycle.day} OF 14 · REVIEW ${state.cycle.reviewLocalDate}`}</Mono>
        <Body color={color.textPrimary}>{state.line.statement}</Body>
        <Caption>
          {due
            ? 'The Cycle is complete. Read it honestly and choose the next standard.'
            : 'You can change a Line early when it is unclear, unrealistic, or no longer right. The current Cycle will stay in your Ledger.'}
        </Caption>
      </HeroPanel>

      {!due ? (
        <Section label="Why change early?">
          <View style={styles.chips}>
            {(Object.keys(EARLY_CHANGE_REASON_LABEL) as EarlyChangeReason[]).map((reason) => (
              <Chip key={reason} label={EARLY_CHANGE_REASON_LABEL[reason]} active={earlyReason === reason} onPress={() => setEarlyReason(reason)} style={styles.fullChip} />
            ))}
          </View>
        </Section>
      ) : (
        <Section label="Private review">
          <Caption>These answers go into your Ledger. Your Crew does not see them.</Caption>
          <Input multiline placeholder="What made this Line easier to hold?" value={easier} onChangeText={setEasier} maxLength={500} />
          <Input multiline placeholder="What usually got in the way?" value={friction} onChangeText={setFriction} maxLength={500} />
          <Input multiline placeholder="What is the next honest standard?" value={nextStandard} onChangeText={setNextStandard} maxLength={500} />
        </Section>
      )}

      <Section label="What comes next?">
        {ACTIONS.filter((option) => due || option.value !== 'keep').map((option) => (
          <Chip
            key={option.value}
            label={`${option.label} · ${option.detail}`}
            active={action === option.value}
            onPress={() => setAction(option.value)}
            style={styles.fullChip}
          />
        ))}
      </Section>

      {changesStatement ? (
        <Section label="Your next Line">
          <Input value={statement} onChangeText={setStatement} maxLength={80} placeholder="State the Line clearly" />
          <View style={styles.chips}>
            <Chip label="A Line I won't cross" active={kind === 'abstain'} onPress={() => setKind('abstain')} style={styles.grow} />
            <Chip label="A bar I'll hold" active={kind === 'hold'} onPress={() => setKind('hold')} style={styles.grow} />
          </View>
        </Section>
      ) : null}

      {error ? <Body color={color.actionText}>{error}</Body> : null}
      <Button label={due ? 'Complete the review' : 'Change the Line honestly'} onPress={submit} loading={busy} disabled={!canSubmit} />
      <Caption center>Tell the truth. That is the work.</Caption>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  fullChip: { width: '100%', alignItems: 'flex-start' },
  grow: { flex: 1 },
});
