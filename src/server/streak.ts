// Streak + local-date logic. THE most correctness-critical code in Reisei, so it
// lives in one place with an explicit rule for timezones, gaps, and verdicts.
//
// A "day" is the user's LOCAL calendar day (users.tz), derived server-side, never the
// device clock. Each day carries a VERDICT:
//   • held  — the line held. Advances the hold streak.
//   • broke — an honest break. Zeroes the hold streak but is still a LOGGED day.
//   • dark  — a MISS. Never a verdict here; it's the ABSENCE of a check-in, detected as
//             a gap (>1 day) on the NEXT check-in. Only a MISS resets INTEGRITY.

export type Verdict = 'held' | 'broke';

/** The user's local calendar date (YYYY-MM-DD) for `at`, in IANA `tz`. */
export function localDateFor(tz: string, at: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(at);
  }
}

/** Whole-day difference between two YYYY-MM-DD strings (b - a), tz-agnostic. */
export function dayDiff(a: string, b: string): number {
  const da = Date.parse(`${a}T00:00:00Z`);
  const db = Date.parse(`${b}T00:00:00Z`);
  return Math.round((db - da) / 86_400_000);
}

export interface StreakState {
  /** Consecutive HELD days — the hold streak. */
  current: number;
  /** Longest hold streak ever. */
  longest: number;
  lastLocalDate: string | null;
  lastVerdict: Verdict | null;
  /** Honest breaks logged on this line. */
  breaks: number;
  /** Times the hold streak was lost (to a break or a miss). */
  resets: number;
  /** Consecutive days LOGGED (held OR broke). Only a MISS (a gap) resets this. */
  integrity: number;
}

export const ZERO_STREAK: StreakState = {
  current: 0, longest: 0, lastLocalDate: null, lastVerdict: null, breaks: 0, resets: 0, integrity: 0,
};

/**
 * Fold a day's VERDICT into the prior streak state. Pure + unit-tested.
 * A same-day repeat is a no-op (the day's verdict is locked once logged).
 */
export function applyCheckIn(prev: StreakState, today: string, verdict: Verdict = 'held'): StreakState {
  if (prev.lastLocalDate === today) return prev;

  const gap = prev.lastLocalDate ? dayDiff(prev.lastLocalDate, today) : Infinity;
  const consecutive = gap === 1; // logged yesterday too → the logged-chain continues
  const missedBefore = !consecutive && prev.current > 0; // a MISS lost the hold streak before this log
  // INTEGRITY tracks the logged-chain (held or broke). Only a miss (gap > 1) breaks it.
  const integrity = consecutive ? prev.integrity + 1 : 1;

  if (verdict === 'held') {
    const current = consecutive ? prev.current + 1 : 1;
    return {
      current,
      longest: Math.max(prev.longest, current),
      lastLocalDate: today,
      lastVerdict: 'held',
      breaks: prev.breaks,
      resets: prev.resets + (missedBefore ? 1 : 0),
      integrity,
    };
  }

  // verdict === 'broke' — honest break: hold streak → 0, but still a logged day.
  const lostStreak = prev.current > 0 || missedBefore;
  return {
    current: 0,
    longest: prev.longest,
    lastLocalDate: today,
    lastVerdict: 'broke',
    breaks: prev.breaks + 1,
    resets: prev.resets + (lostStreak ? 1 : 0),
    integrity,
  };
}
