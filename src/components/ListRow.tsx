import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { color, space } from '@/theme';
import { Body, Caption } from './Text';

export function ListRow({ title, detail, leading, trailing, onPress }: { title: string; detail?: string | null; leading?: ReactNode; trailing?: ReactNode; onPress?: () => void }) {
  const content = <>{leading}<View style={styles.body}><Body color={color.textPrimary}>{title}</Body>{detail ? <Caption>{detail}</Caption> : null}</View>{trailing}</>;
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => [styles.root, pressed && styles.pressed]}>{content}</Pressable>
  ) : <View style={styles.root}>{content}</View>;
}

const styles = StyleSheet.create({
  root: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  body: { flex: 1, gap: space.xs },
  pressed: { opacity: 0.76 },
});
