import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Body, Button, Caption, Mono, Screen, Text, Title } from '@/components';
import { logReset } from '@/lib/data/client';
import { color, palette, radius, space } from '@/theme';

// Reset — a ~60s box-breathing + grounding protocol. Mindfulness in a discipline
// costume: "get your head right," not "meditate". Surfaced by the coach on hard days.
const ROUNDS = 4;
const PHASE_MS = 4000;
const PHASES: { label: string; to: number }[] = [
  { label: 'Breathe in', to: 1.55 },
  { label: 'Hold', to: 1.55 },
  { label: 'Breathe out', to: 1.0 },
  { label: 'Hold', to: 1.0 },
];

export default function Reset() {
  const [step, setStep] = useState<'breathe' | 'ground'>('breathe');
  const [phase, setPhase] = useState(PHASES[0].label);
  const [round, setRound] = useState(1);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (step !== 'breathe') return;
    let cancelled = false;
    let i = 0;
    let r = 0;
    const run = () => {
      if (cancelled) return;
      const p = PHASES[i];
      setPhase(p.label);
      setRound(r + 1);
      if (p.label === 'Breathe in') void Haptics.selectionAsync();
      Animated.timing(scale, { toValue: p.to, duration: PHASE_MS, useNativeDriver: true }).start();
      setTimeout(() => {
        if (cancelled) return;
        i += 1;
        if (i >= PHASES.length) {
          i = 0;
          r += 1;
        }
        if (r >= ROUNDS) {
          setStep('ground');
          return;
        }
        run();
      }, PHASE_MS);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [step, scale]);

  async function finish() {
    setBusy(true);
    await logReset(note.trim() || undefined);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setBusy(false);
    router.back();
  }

  if (step === 'breathe') {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <Mono>{`ROUND ${round} / ${ROUNDS}`}</Mono>
          <View style={styles.circleWrap}>
            <Animated.View style={[styles.circle, { transform: [{ scale }] }]} />
          </View>
          <Title>{phase}</Title>
          <Caption center>Box breathing. Four counts each. Just follow it.</Caption>
          <Button label="Skip to grounding" variant="ghost" onPress={() => setStep('ground')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Head clear?</Title>
      <Body>Name the one thing that’s actually yours to move right now. Not the whole mess. Just the one thing.</Body>
      <TextInput
        placeholder="The one thing…"
        placeholderTextColor={color.textSecondary}
        value={note}
        onChangeText={setNote}
        maxLength={140}
        multiline
        style={styles.input}
      />
      <Body color={color.textSecondary}>Then do that. Nothing else needs you right now.</Body>
      <Button label="Done. Back to level" onPress={finish} loading={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl },
  circleWrap: { height: 220, alignItems: 'center', justifyContent: 'center' },
  circle: { width: 120, height: 120, borderRadius: 60, backgroundColor: palette.bubble, borderWidth: 2, borderColor: palette.bubbleLight },
  input: {
    minHeight: 96,
    backgroundColor: color.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.rule,
    padding: space.lg,
    color: color.textPrimary,
    fontFamily: 'IBMPlexSans_400Regular',
    fontSize: 18,
    textAlignVertical: 'top',
  },
});
