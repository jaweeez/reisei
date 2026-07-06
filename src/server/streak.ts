// Streak + local-date logic. THE most correctness-critical code in Reisei, so it
// lives in one place with an explicit rule for timezones and gaps.
//
// Rules:
//   • A "day" is the user's LOCAL calendar day, derived server-side from a stored
//     IANA timezone (users.tz) — never the device clock.
//   • One check-in per local day (enforced by a unique (user_id, local_date) index).
//   • Streak continues if today's local_date is exactly one day after last_local_date;
//     resets to 1 on any larger gap; stays put on a same-day repeat.

/** The user's local calendar date (YYYY-MM-DD) for `at`, in IANA `tz`. */
export function localDateFor(tz: string, at: Date = new Date()): string {
  // en-CA gives ISO-style YYYY-MM-DD; the timeZone does the offset math incl. DST.
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(at);
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
  current: number;
  longest: number;
  lastLocalDate: string | null;
}

/** Fold a new check-in on `today` into the prior streak state. Pure + unit-testable. */
export function applyCheckIn(prev: StreakState, today: string): StreakState {
  if (prev.lastLocalDate === today) return prev; // same-day repeat: no change
  const gap = prev.lastLocalDate ? dayDiff(prev.lastLocalDate, today) : Infinity;
  const current = gap === 1 ? prev.current + 1 : 1; // consecutive → +1, else reset to 1
  return {
    current,
    longest: Math.max(prev.longest, current),
    lastLocalDate: today,
  };
}
