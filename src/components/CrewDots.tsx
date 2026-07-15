import { StyleSheet, View, type ViewStyle } from 'react-native';
import { palette, space } from '@/theme';
import type { CrewMemberView, Posture } from '@/lib/data/types';

// The crew posture language, in one place. Presence is bubble's reserved role (brass is
// for actions only — see the brand kit), so all three states stay in the presence family:
//   held  → filled bubble (the line held)
//   broke → hollow bubble-light ring (an honest break — present, witnessed, respected)
//   dark  → hollow steel-dark ring (logged nothing yet), per the kit's empty crew dot
export function postureStyle(posture: Posture, size = 22): ViewStyle {
  const base: ViewStyle = { width: size, height: size, borderRadius: size / 2, borderWidth: 2 };
  if (posture === 'held') return { ...base, backgroundColor: palette.bubble, borderColor: palette.bubble };
  if (posture === 'broke') return { ...base, backgroundColor: 'transparent', borderColor: palette.bubbleLight };
  return { ...base, backgroundColor: 'transparent', borderColor: palette.steelDark };
}

/** One posture dot — the same artifact everywhere it appears (roster, ledger, marketing). */
export function PostureDot({ posture, size = 22, style }: { posture: Posture; size?: number; style?: ViewStyle }) {
  return <View style={[postureStyle(posture, size), style]} />;
}

/** The crew posture row. One dot per member. */
export function CrewDots({ members }: { members: CrewMemberView[] }) {
  const held = members.filter((m) => m.posture === 'held').length;
  const broke = members.filter((m) => m.posture === 'broke').length;
  const dark = members.length - held - broke;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`Crew: ${held} held, ${broke} honest breaks, ${dark} not logged yet`}
    >
      {members.map((m) => (
        <PostureDot key={m.id} posture={m.posture} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
});
