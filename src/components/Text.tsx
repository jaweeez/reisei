import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { type as presets, type TypePreset } from '@/theme';

export type TextProps = RNTextProps & {
  variant?: TypePreset;
  color?: string;
  center?: boolean;
};

/** The one text primitive. Every string in the app goes through this. */
export function Text({ variant = 'body', color, center, style, ...rest }: TextProps) {
  return (
    <RNText style={[presets[variant], color ? { color } : null, center ? { textAlign: 'center' } : null, style]} {...rest} />
  );
}

export const Hero = (p: Omit<TextProps, 'variant'>) => <Text variant="hero" {...p} />;
export const Display = (p: Omit<TextProps, 'variant'>) => <Text variant="display" {...p} />;
export const Title = (p: Omit<TextProps, 'variant'>) => <Text variant="title" {...p} />;
export const Heading = (p: Omit<TextProps, 'variant'>) => <Text variant="heading" {...p} />;
export const Body = (p: Omit<TextProps, 'variant'>) => <Text variant="body" {...p} />;
export const Caption = (p: Omit<TextProps, 'variant'>) => <Text variant="caption" {...p} />;
export const Mono = (p: Omit<TextProps, 'variant'>) => <Text variant="mono" {...p} />;
export const Eyebrow = (p: Omit<TextProps, 'variant'>) => <Text variant="eyebrow" {...p} />;
