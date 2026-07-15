import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '@/theme';
import { Body, Title } from './Text';

export function EmptyState({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return <View style={styles.root}><Title>{title}</Title><Body>{body}</Body>{children}</View>;
}

const styles = StyleSheet.create({
  root: { minHeight: 240, justifyContent: 'center', gap: space.lg, paddingVertical: space.section },
});
