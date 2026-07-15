import { Pressable, StyleSheet, View } from 'react-native';
import { color, radius, space } from '@/theme';
import { Body, Caption, Eyebrow, Mono } from './Text';

export function IntegrityAgreement({ accepted, onChange }: { accepted: boolean; onChange: (accepted: boolean) => void }) {
  return (
    <View style={styles.root}>
      <Eyebrow>The honesty agreement</Eyebrow>
      <Body color={color.textPrimary}>
        Reisei only works if you tell the truth. If you lie to yourself or your Crew, you are wasting your time and theirs. Report the miss. The point is integrity, not a perfect streak.
      </Body>
      <Caption>
        Your Crew sees your Line and whether you held it, broke it, or did not check in. Your Log, notes, Bearings, and recovery details stay private.
      </Caption>
      <Pressable
        onPress={() => onChange(!accepted)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: accepted }}
        style={({ pressed }) => [styles.choice, accepted && styles.choiceAccepted, pressed && styles.pressed]}
      >
        <View style={[styles.box, accepted && styles.boxAccepted]}>{accepted ? <Mono color={color.bg}>✓</Mono> : null}</View>
        <Body color={color.textPrimary}>I will report honestly.</Body>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md, paddingVertical: space.sm },
  choice: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderColor: color.ruleStrong,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  choiceAccepted: { borderColor: color.action, backgroundColor: color.actionSoft },
  box: { width: 24, height: 24, borderWidth: 1, borderColor: color.textSecondary, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  boxAccepted: { backgroundColor: color.action, borderColor: color.action },
  pressed: { opacity: 0.8 },
});
