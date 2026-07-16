// Recovery mode: sober/clean-time in CHAPTERS, not a shame streak (docs/RECOVERY_EXPANSION.md,
// modeled on Enso's recovery tracker). "Begin again" ends the current chapter and starts a new one;
// prior chapters are preserved. A day count is optional (show_count) so it can coexist with Reisei's
// "integrity, not a perfect streak" principle. This module is pure: day + milestone math, no DB.

export interface Milestone {
  key: string;
  label: string;
  days: number;
}

// Milestones by days sober. "24 hours" first, then the familiar markers, then each full year.
// Encouraging and plain, never clinical.
const MILESTONE_DEFS: Milestone[] = [
  { key: '1d', label: '24 hours', days: 1 },
  { key: '1w', label: '1 week', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '60d', label: '60 days', days: 60 },
  { key: '90d', label: '90 days', days: 90 },
  { key: '6mo', label: '6 months', days: 182 },
  { key: '9mo', label: '9 months', days: 273 },
  { key: '1y', label: '1 year', days: 365 },
];

/** Whole days from `startISO` to `todayISO` (0 on the start day). Both are YYYY-MM-DD local dates. */
export function daysSince(startISO: string, todayISO: string): number {
  const s = Date.parse(`${startISO}T00:00:00Z`);
  const t = Date.parse(`${todayISO}T00:00:00Z`);
  if (Number.isNaN(s) || Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((t - s) / 86_400_000));
}

/** The highest milestone reached at `days` sober, or null before the first. After a year, each
 *  full year is its own milestone ("2 years", "3 years", ...). */
export function milestoneReached(days: number): Milestone | null {
  let reached: Milestone | null = null;
  for (const m of MILESTONE_DEFS) if (days >= m.days) reached = m;
  const years = Math.floor(days / 365);
  if (years >= 2) reached = { key: `${years}y`, label: `${years} years`, days: years * 365 };
  return reached;
}

/** True when `days` lands exactly on a milestone (for a quiet nudge). */
export function isMilestoneDay(days: number): boolean {
  if (days <= 0) return false;
  if (MILESTONE_DEFS.some((m) => m.days === days)) return true;
  return days % 365 === 0;
}
