import { type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { color, radius, space } from '@/theme';

export function HeroPanel({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.root, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { backgroundColor: color.card, borderRadius: radius.xl, borderWidth: 1, borderColor: color.ruleStrong, padding: space.xxl, gap: space.lg },
});
