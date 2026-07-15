import { dayDiff } from './streak';

export const CYCLE_DAYS = 14;

export function cycleDay(startLocalDate: string, today: string): number {
  return Math.max(1, Math.min(CYCLE_DAYS, dayDiff(startLocalDate, today) + 1));
}

export function cycleReviewDue(reviewLocalDate: string, today: string): boolean {
  return dayDiff(reviewLocalDate, today) >= 0;
}

export interface CycleEvent {
  date: string;
  verdict: 'held' | 'broke';
}

export function cycleStats(events: CycleEvent[], start: string, end: string) {
  const ordered = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const held = ordered.filter((e) => e.verdict === 'held').length;
  const broke = ordered.filter((e) => e.verdict === 'broke').length;
  const totalDays = Math.max(1, dayDiff(start, end) + 1);
  let recoveries = 0;
  let recoveryDays = 0;

  for (let i = 0; i < ordered.length; i += 1) {
    if (ordered[i].verdict !== 'broke') continue;
    const nextHeld = ordered.slice(i + 1).find((e) => e.verdict === 'held');
    if (!nextHeld) continue;
    const days = dayDiff(ordered[i].date, nextHeld.date);
    if (days <= 2) {
      recoveries += 1;
      recoveryDays += days;
    }
  }

  return {
    held,
    broke,
    quiet: Math.max(0, totalDays - held - broke),
    holdRate: held + broke ? Math.round((held / (held + broke)) * 100) : null,
    recoveryRate: broke ? Math.round((recoveries / broke) * 100) : null,
    averageRecoveryDays: recoveries ? Math.round((recoveryDays / recoveries) * 10) / 10 : null,
  };
}
