import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { color, radius, space } from '@/theme';
import { Text } from './Text';

// The one selectable chip (line kind, hold time, schools, admin grant). Mono label per the
// type roles (labels/data are Mono's job), brass fill when active, selection haptic baked in.
export function Chip({
  label,
  active = false,
  onPress,
  disabled = false,
  style,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress?.();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      style={({ pressed }) => [
        styles.base,
        active && styles.active,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text variant="mono" color={active ? color.bg : color.textBody}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.rule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: { backgroundColor: color.action, borderColor: color.action },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.45 },
});
