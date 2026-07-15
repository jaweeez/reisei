import { StyleSheet, View } from 'react-native';
import { color, radius, space } from '@/theme';
import { Mono } from './Text';

export function StatusPill({ label, tone = 'quiet' }: { label: string; tone?: 'held' | 'broke' | 'quiet' | 'review' }) {
  return <View style={[styles.root, tone === 'held' && styles.held, tone === 'broke' && styles.broke, tone === 'review' && styles.review]}><Mono color={tone === 'held' ? color.textPrimary : tone === 'quiet' ? color.textSecondary : color.actionText}>{label}</Mono></View>;
}

const styles = StyleSheet.create({
  root: { borderRadius: radius.pill, borderWidth: 1, borderColor: color.ruleStrong, paddingHorizontal: space.sm, paddingVertical: space.xs },
  held: { backgroundColor: color.presence, borderColor: color.presence },
  broke: { borderColor: color.presenceLight },
  review: { backgroundColor: color.actionSoft, borderColor: color.action },
});
