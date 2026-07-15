import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Body, Button, Caption, Input, Mono, Screen, Title } from '@/components';
import { logReset } from '@/lib/data/client';
import { color, space } from '@/theme';

// Reset — a ~60s box-breathing protocol. Get out of your head, back in your body:
// "get your head right," not "meditate". Surfaced by the coach on hard days.
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
  const [count, setCount] = useState(PHASE_MS / 1000);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [scale] = useState(() => new Animated.Value(1));
  const reduceMotion = useRef(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      reduceMotion.current = enabled;
    });
  }, []);

  useEffect(() => {
    if (step !== 'breathe') return;
    let cancelled = false;
    let i = 0;
    let r = 0;
    let tick: ReturnType<typeof setInterval> | undefined;
    let phaseTimer: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      if (cancelled) return;
      const p = PHASES[i];
      setPhase(p.label);
      setRound(r + 1);
      void Haptics.selectionAsync();
      // Reduce-motion: the phase title, count, and haptics carry the pacing.
      if (!reduceMotion.current) {
        Animated.timing(scale, { toValue: p.to, duration: PHASE_MS, useNativeDriver: true }).start();
      }
      let c = PHASE_MS / 1000;
      setCount(c);
      tick = setInterval(() => {
        c -= 1;
        if (!cancelled && c >= 1) setCount(c);
      }, 1000);
      phaseTimer = setTimeout(() => {
        if (tick) clearInterval(tick);
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
      if (tick) clearInterval(tick);
      if (phaseTimer) clearTimeout(phaseTimer);
    };
  }, [step, scale]);

  async function finish() {
    setBusy(true);
    await logReset(note.trim() || undefined);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setBusy(false);
    router.back();
  }

  const header = (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Mono>RESET</Mono>
      <Pressable
        onPress={() => router.back()}
        hitSlop={{ top: 14, bottom: 14, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <Mono>Close</Mono>
      </Pressable>
    </View>
  );

  if (step === 'breathe') {
    return (
      <Screen scroll={false}>
        {header}
        <View style={styles.center}>
          <Mono>{`ROUND ${round} / ${ROUNDS}`}</Mono>
          <View style={styles.circleWrap}>
            <Animated.View style={[styles.circle, { transform: [{ scale }] }]} />
          </View>
          <Title>{phase}</Title>
          <Mono color={color.textSecondary}>{count}</Mono>
          <Caption center>Box breathing. Four counts each. Just follow it.</Caption>
          <Button label="Skip ahead" variant="ghost" onPress={() => setStep('ground')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      {header}
      <Title>Head clear?</Title>
      <Body>Name the one thing that’s actually yours to move right now. Not the whole mess. Just the one thing.</Body>
      <Input multiline placeholder="The one thing…" value={note} onChangeText={setNote} maxLength={140} />
      <Body color={color.textSecondary}>Then do that. Nothing else needs you right now.</Body>
      <Button label="Done. Back to level" onPress={finish} loading={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl },
  circleWrap: { height: 220, alignItems: 'center', justifyContent: 'center' },
  circle: { width: 120, height: 120, borderRadius: 60, backgroundColor: color.presence, borderWidth: 2, borderColor: color.presenceLight },
});
