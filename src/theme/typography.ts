import { type TextStyle } from 'react-native';
import { color } from './tokens';

/** Family names as registered by useFonts(fontModules) in fonts.ts. */
export const fontFamily = {
  display: 'BigShouldersDisplay_900Black',
  displaySemi: 'BigShouldersDisplay_600SemiBold',
  displayReg: 'BigShouldersDisplay_400Regular',
  body: 'IBMPlexSans_400Regular',
  bodyMedium: 'IBMPlexSans_500Medium',
  bodySemi: 'IBMPlexSans_600SemiBold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
} as const;

/**
 * Type presets. Display is uppercase Big Shoulders (Day 14). Body is Plex Sans.
 * Mono carries data + labels (STREAK 04 · CREW 6/8), always tracked + uppercase.
 */
export const type = {
  hero: {
    fontFamily: fontFamily.display,
    fontSize: 64,
    lineHeight: 60,
    letterSpacing: -0.5,
    textTransform: 'uppercase',
    color: color.textPrimary,
  },
  display: {
    fontFamily: fontFamily.display,
    fontSize: 44,
    lineHeight: 42,
    letterSpacing: -0.3,
    textTransform: 'uppercase',
    color: color.textPrimary,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 30,
    lineHeight: 29,
    letterSpacing: -0.2,
    textTransform: 'uppercase',
    color: color.textPrimary,
  },
  /** The epigraph / statement role from the brand kit: Big Shoulders SemiBold, sentence
   *  case, ~1.25 line-height. Carries the Bearing's daily quote. */
  quote: {
    fontFamily: fontFamily.displaySemi,
    fontSize: 24,
    lineHeight: 30,
    color: color.textPrimary,
  },
  heading: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 18,
    lineHeight: 24,
    color: color.textPrimary,
  },
  body: {
    fontFamily: fontFamily.body,
    fontSize: 16,
    lineHeight: 24,
    color: color.textBody,
  },
  bodyStrong: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 16,
    lineHeight: 24,
    color: color.textPrimary,
  },
  caption: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    color: color.textSecondary,
  },
  /** data + labels: STREAK 04 · LOGGED 06:42 · CREW 6/8 */
  mono: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: color.actionText,
  },
  eyebrow: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: color.action,
  },
} satisfies Record<string, TextStyle>;

export type TypePreset = keyof typeof type;
