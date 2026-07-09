import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, space } from '@/theme';

// The app is a single-column mobile experience. On a phone that column is the whole
// screen; on web (react-native-web) the viewport can be arbitrarily wide, so we cap the
// content at a phone-ish width and centre it — otherwise inputs and cards stretch
// edge-to-edge on desktop. maxWidth 480 ≥ any phone, so native is unaffected.
const COLUMN_MAX = 480;

/** The ink page. Scrollable by default, safe-area + keyboard aware, centred max-width column. */
export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  // Native gets the real notch inset; web reports 0, so guarantee breathing room there.
  const pad = { paddingTop: Math.max(insets.top, space.xl) + space.lg, paddingBottom: insets.bottom + space.huge };

  if (!scroll) {
    return (
      <View style={[styles.root, styles.center]}>
        <View style={[styles.column, styles.fill, pad, styles.padX]}>{children}</View>
      </View>
    );
  }
  return (
    <View style={styles.root}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.column, pad, styles.padX]}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
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
