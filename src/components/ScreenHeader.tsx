import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Mono, Title } from './Text';

// The one pushed-screen header: Title left, quiet Mono Close right. Every screen you can
// leave gets the same exit, in the same corner (dismissal had four divergent patterns).
const CLOSE_SLOP = { top: 14, bottom: 14, left: 12, right: 12 };

export function ScreenHeader({
  title,
  closeLabel = 'Close',
  onClose,
}: {
  title: string;
  closeLabel?: string;
  onClose?: () => void;
}) {
  return (
    <View style={styles.row}>
      <Title style={styles.title}>{title}</Title>
      <Pressable
        onPress={onClose ?? (() => router.back())}
        hitSlop={CLOSE_SLOP}
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
      >
        <Mono>{closeLabel}</Mono>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  title: { flexShrink: 1 },
});
