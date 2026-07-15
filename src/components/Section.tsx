import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { color, space } from '@/theme';
import { Eyebrow, Mono } from './Text';

export function Section({ label, children, action }: { label: string; children: ReactNode; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Eyebrow>{label}</Eyebrow>
        {action ? <Pressable onPress={action.onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={action.label}><Mono>{action.label}</Mono></Pressable> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderTopWidth: 1, borderTopColor: color.rule, paddingTop: space.xl, gap: space.md },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
});
