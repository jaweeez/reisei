import { StyleSheet, View } from 'react-native';
import { color, palette, space } from '@/theme';
import type { CrewMemberView } from '@/lib/data/types';

/** The crew presence row — a filled bubble dot per member who has checked in today. */
export function CrewDots({ members }: { members: CrewMemberView[] }) {
  return (
    <View style={styles.row}>
      {members.map((m) => (
        <View key={m.id} style={[styles.dot, m.checkedInToday ? styles.filled : styles.empty]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2 },
  filled: { backgroundColor: palette.bubble, borderColor: palette.bubble },
  empty: { backgroundColor: 'transparent', borderColor: color.ruleStrong },
});
