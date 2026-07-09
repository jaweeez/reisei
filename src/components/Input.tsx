import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { color, fontFamily, radius, space } from '@/theme';

// The one text input. Every field in the app goes through this so the form language
// can't drift (it had: font sizes, backgrounds, and raw font strings had all diverged).
//   - default surface sits on the ink page (card-colored fill)
//   - `inCard` sits inside a Card (page-colored fill, one step darker)
//   - `multiline` becomes the tall write box (log entries, bearing notes)
export function Input({ inCard = false, multiline = false, style, ...rest }: TextInputProps & { inCard?: boolean }) {
  return (
    <TextInput
      placeholderTextColor={color.textSecondary}
      multiline={multiline}
      style={[styles.base, inCard && styles.inCard, multiline && styles.multiline, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    backgroundColor: color.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.rule,
    paddingHorizontal: space.lg,
    color: color.textPrimary,
    fontFamily: fontFamily.body,
    fontSize: 16,
  },
  inCard: { backgroundColor: color.bg },
  multiline: {
    minHeight: 120,
    padding: space.lg,
    textAlignVertical: 'top',
  },
});
