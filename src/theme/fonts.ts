/**
 * Font modules bundled via the @expo-google-fonts packages (open license, safe
 * to embed). Passed to useFonts() at the root so every screen can reference the
 * family names in src/theme/typography.ts.
 *
 * Three roles, per the brand guide:
 *   - Big Shoulders Display 900 → display (Day 14, headlines)
 *   - IBM Plex Sans            → body
 *   - IBM Plex Mono            → data + labels (STREAK 04 · CREW 6/8)
 */
import {
  BigShouldersDisplay_400Regular,
  BigShouldersDisplay_600SemiBold,
  BigShouldersDisplay_900Black,
} from '@expo-google-fonts/big-shoulders-display';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';

export const fontModules = {
  BigShouldersDisplay_400Regular,
  BigShouldersDisplay_600SemiBold,
  BigShouldersDisplay_900Black,
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
} as const;
