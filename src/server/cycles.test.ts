/// <reference types="jest" />
import { cycleDay, cycleReviewDue, cycleStats } from './cycles';

describe('Line Cycle timing', () => {
  it('counts fourteen commitment days before review is due', () => {
    expect(cycleDay('2026-07-01', '2026-07-01')).toBe(1);
    expect(cycleDay('2026-07-01', '2026-07-14')).toBe(14);
    expect(cycleReviewDue('2026-07-15', '2026-07-14')).toBe(false);
    expect(cycleReviewDue('2026-07-15', '2026-07-15')).toBe(true);
  });
});

describe('Cycle reports', () => {
  it('counts honest breaks, quiet days, and two-day recoveries', () => {
    expect(
      cycleStats(
        [
          { date: '2026-07-01', verdict: 'held' },
          { date: '2026-07-02', verdict: 'broke' },
          { date: '2026-07-04', verdict: 'held' },
        ],
        '2026-07-01',
        '2026-07-05',
      ),
    ).toEqual({ held: 2, broke: 1, quiet: 2, holdRate: 67, recoveryRate: 100, averageRecoveryDays: 2 });
  });
});
