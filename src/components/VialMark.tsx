import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { palette } from '@/theme';

/**
 * The Reisei mark: a level vial with the bubble dead center. Centered = reisei —
 * steady, level, in check. `off` nudges the bubble (only ever off-center mid-motion).
 */
export function VialMark({ width = 220, off = 0 }: { width?: number; off?: number }) {
  const height = (width / 220) * 72;
  return (
    <Svg width={width} height={height} viewBox="0 0 220 72">
      <Rect x="12" y="18" width="196" height="36" rx="18" fill="none" stroke={palette.bone} strokeWidth={2.5} />
      <Line x1="110" y1="10" x2="110" y2="22" stroke={palette.brassBright} strokeWidth={2} />
      <Line x1="110" y1="50" x2="110" y2="62" stroke={palette.brassBright} strokeWidth={2} />
      <Circle cx={110 + off} cy="36" r="15" fill={palette.bubbleLight} />
    </Svg>
  );
}
