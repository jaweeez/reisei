/// <reference types="jest" />
import { applyCheckIn, dayDiff, localDateFor, type StreakState } from './streak';

// The streak logic is the most correctness-critical code in Reisei — cover the
// midnight/gap/timezone edges here.

describe('localDateFor', () => {
  it('derives the local calendar day from an IANA tz', () => {
    // 2026-01-01T04:00Z is still Dec 31 in New York (UTC-5).
    const at = new Date('2026-01-01T04:00:00Z');
    expect(localDateFor('America/New_York', at)).toBe('2025-12-31');
    expect(localDateFor('UTC', at)).toBe('2026-01-01');
  });

  it('falls back to UTC on a bad tz', () => {
    const at = new Date('2026-06-01T12:00:00Z');
    expect(localDateFor('Not/AZone', at)).toBe('2026-06-01');
  });
});

describe('dayDiff', () => {
  it('counts whole days, DST-agnostic', () => {
    expect(dayDiff('2026-03-07', '2026-03-09')).toBe(2); // spans US spring-forward
    expect(dayDiff('2026-01-01', '2026-01-01')).toBe(0);
  });
});

describe('applyCheckIn', () => {
  const base: StreakState = { current: 3, longest: 5, lastLocalDate: '2026-01-10' };

  it('increments on a consecutive day', () => {
    expect(applyCheckIn(base, '2026-01-11')).toEqual({ current: 4, longest: 5, lastLocalDate: '2026-01-11' });
  });

  it('bumps longest when current passes it', () => {
    const s: StreakState = { current: 5, longest: 5, lastLocalDate: '2026-01-10' };
    expect(applyCheckIn(s, '2026-01-11')).toEqual({ current: 6, longest: 6, lastLocalDate: '2026-01-11' });
  });

  it('resets to 1 after a gap', () => {
    expect(applyCheckIn(base, '2026-01-13')).toEqual({ current: 1, longest: 5, lastLocalDate: '2026-01-13' });
  });

  it('is a no-op on a same-day repeat', () => {
    expect(applyCheckIn(base, '2026-01-10')).toBe(base);
  });

  it('starts at 1 from a fresh account', () => {
    const fresh: StreakState = { current: 0, longest: 0, lastLocalDate: null };
    expect(applyCheckIn(fresh, '2026-01-10')).toEqual({ current: 1, longest: 1, lastLocalDate: '2026-01-10' });
  });
});
