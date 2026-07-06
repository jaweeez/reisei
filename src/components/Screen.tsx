import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, space } from '@/theme';

/** The ink page. Scrollable by default, safe-area aware. */
export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  const pad = { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.huge };

  if (!scroll) {
    return <View style={[styles.root, pad, styles.padX]}>{children}</View>;
  }
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[pad, styles.padX]} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  padX: { paddingHorizontal: space.xl, gap: space.xl },
});
