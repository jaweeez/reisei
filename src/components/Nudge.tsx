import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { color, radius, space } from '@/theme';
import { Body, Mono } from './Text';

// The one banner/nudge container (the coach line, the log prompt, the bearing card, the
// crisis card's shell all share this recipe — it was declared five times before).
//   accent → brass left rail on a soft brass wash: something is asking for attention
//   quiet  → hairline card: an ambient affordance, not a demand
export function Nudge({
  variant = 'accent',
  label,
  body,
  onPress,
  children,
  accessibilityLabel,
}: {
  variant?: 'accent' | 'quiet';
  label: string;
  body?: string;
  onPress?: () => void;
  children?: ReactNode;
  accessibilityLabel?: string;
}) {
  const content = (
    <>
      <Mono color={color.actionText}>{label}</Mono>
      {body ? <Body color={color.textPrimary}>{body}</Body> : null}
      {children}
    </>
  );
  const boxStyle = [styles.base, variant === 'accent' ? styles.accent : styles.quiet];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? `${label}. ${body ?? ''}`.trim()}
        style={({ pressed }) => [...boxStyle, pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }
  return <View style={boxStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  base: { gap: space.xs, padding: space.lg, borderRadius: radius.md },
  accent: { borderLeftWidth: 3, borderLeftColor: color.action, backgroundColor: color.actionSoft },
  quiet: { borderWidth: 1, borderColor: color.rule, backgroundColor: color.card },
  pressed: { opacity: 0.82 },
});
