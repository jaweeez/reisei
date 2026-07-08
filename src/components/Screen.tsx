import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, space } from '@/theme';

// The app is a single-column mobile experience. On a phone that column is the whole
// screen; on web (react-native-web) the viewport can be arbitrarily wide, so we cap the
// content at a phone-ish width and centre it — otherwise inputs and cards stretch
// edge-to-edge on desktop. maxWidth 480 ≥ any phone, so native is unaffected.
const COLUMN_MAX = 480;

/** The ink page. Scrollable by default, safe-area aware, centred max-width column. */
export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  const pad = { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.huge };

  if (!scroll) {
    return (
      <View style={[styles.root, styles.center]}>
        <View style={[styles.column, styles.fill, pad, styles.padX]}>{children}</View>
      </View>
    );
  }
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.column, pad, styles.padX]}>{children}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  center: { alignItems: 'center' },
  // flexGrow + alignItems centres the column horizontally and lets short screens fill height.
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  column: { width: '100%', maxWidth: COLUMN_MAX, gap: space.xl },
  fill: { flex: 1 },
  padX: { paddingHorizontal: space.xl },
});
