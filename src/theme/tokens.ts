/**
 * Reisei design tokens — transcribed directly from reisei-brand-guide.html.
 *
 * "Five colors." Reisei is an ink-dark app: most surfaces are ink, brass is the
 * only action color, and bubble green is reserved for the mark + streak/crew
 * presence. Off-center means something's off; centered means reisei.
 */

export const palette = {
  /** ink — primary surface + headlines. The app is dark. */
  ink: '#1B1918',
  /** a slightly lifted ink for cards resting on the page. */
  inkSoft: '#2A2725',
  /** steel — body text on dark, quiet dividers. */
  steel: '#8A8F8C',
  /** a darker steel for borders and secondary rules. */
  steelDark: '#5B6063',
  /** bone — the light surface / paper stock. */
  bone: '#EDE8DE',
  /** a dimmer bone for pressed / muted light fills. */
  boneDim: '#E1DACB',
  /** brass — actions, emphasis, dividers. The one action color. */
  brass: '#B8863E',
  /** a brighter brass for text accents on ink. */
  brassBright: '#D3A25C',
  /** bubble — the mark, streaks, crew presence. */
  bubble: '#46583F',
  /** a lighter bubble for active dots / labels. */
  bubbleLight: '#6C8261',
} as const;

/** Semantic aliases. Prefer these in components over raw palette names. */
export const color = {
  bg: palette.ink,
  card: palette.inkSoft,

  textPrimary: palette.bone,
  textBody: palette.steel,
  textSecondary: palette.steelDark,

  /** hairline rules and quiet dividers on ink */
  rule: 'rgba(237,232,222,0.10)',
  ruleStrong: 'rgba(237,232,222,0.18)',

  /** brass — the action color. Buttons, emphasis, dividers. */
  action: palette.brass,
  actionText: palette.brassBright,
  actionSoft: 'rgba(184,134,62,0.14)',

  /** bubble — the mark, streaks, crew presence. */
  presence: palette.bubble,
  presenceLight: palette.bubbleLight,
  presenceSoft: 'rgba(70,88,63,0.16)',

  /** light-surface tokens (bone screens, e.g. marketing / paywall on bone) */
  boneBg: palette.bone,
  onBoneText: palette.ink,

  scrim: 'rgba(27,25,24,0.60)',
} as const;

/** 4-pt spacing scale, matching the brand kit's rhythm. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  section: 48,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 14,
  xl: 20,
  /** the app-icon corner radius from the brand kit */
  icon: 26,
  pill: 999,
} as const;

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;

export type PaletteName = keyof typeof palette;
