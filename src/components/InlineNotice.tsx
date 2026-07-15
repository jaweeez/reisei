import { Pressable, StyleSheet, View } from 'react-native';
import { color, space } from '@/theme';
import { Body, Eyebrow } from './Text';

export function InlineNotice({ label, body, onPress }: { label: string; body: string; onPress?: () => void }) {
  const content = <><Eyebrow>{label}</Eyebrow><Body>{body}</Body></>;
  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => [styles.root, pressed && styles.pressed]} accessibilityRole="button">{content}</Pressable> : <View style={styles.root}>{content}</View>;
}

const styles = StyleSheet.create({
  root: { borderLeftWidth: 2, borderLeftColor: color.action, paddingLeft: space.lg, paddingVertical: space.xs, gap: space.xs },
  pressed: { opacity: 0.76 },
});
