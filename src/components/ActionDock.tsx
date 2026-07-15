import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { color, space } from '@/theme';
import { Caption } from './Text';

export function ActionDock({ children, reminder }: { children: ReactNode; reminder?: string }) {
  return <View style={styles.root}>{reminder ? <Caption center>{reminder}</Caption> : null}{children}</View>;
}

const styles = StyleSheet.create({
  root: { borderTopWidth: 1, borderTopColor: color.ruleStrong, paddingTop: space.lg, gap: space.sm },
});
