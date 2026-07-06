import { StyleSheet, View } from 'react-native';
import { color, palette, space } from '@/theme';
import type { CrewMemberView } from '@/lib/data/types';

// The crew posture row. One dot per member:
//   held  → filled bubble (the line held)
//   broke → brass ring, hollow center (an honest break — witnessed, respected)
//   dark  → hollow steel (logged nothing yet)
export function CrewDots({ members }: { members: CrewMemberView[] }) {
  return (
    <View style={styles.row}>
      {members.map((m) => (
        <View
          key={m.id}
          style={[
            styles.dot,
            m.posture === 'held' && styles.held,
            m.posture === 'broke' && styles.broke,
            m.posture === 'dark' && styles.dark,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2 },
  held: { backgroundColor: palette.bubble, borderColor: palette.bubble },
  broke: { backgroundColor: 'transparent', borderColor: palette.brass },
  dark: { backgroundColor: 'transparent', borderColor: color.ruleStrong },
});
