/// <reference types="jest" />
import { applyCheckIn, dayDiff, localDateFor, ZERO_STREAK, type StreakState } from './streak';

// The streak logic is the most correctness-critical code in Reisei — cover the
// midnight/gap/timezone edges AND the verdict (held/broke/dark) + integrity rules.

const S = (over: Partial<StreakState>): StreakState => ({ ...ZERO_STREAK, ...over });

describe('localDateFor', () => {
  it('derives the local calendar day from an IANA tz', () => {
    const at = new Date('2026-01-01T04:00:00Z'); // still Dec 31 in New York (UTC-5)
    expect(localDateFor('America/New_York', at)).toBe('2025-12-31');
    expect(localDateFor('UTC', at)).toBe('2026-01-01');
  });
  it('falls back to UTC on a bad tz', () => {
    expect(localDateFor('Not/AZone', new Date('2026-06-01T12:00:00Z'))).toBe('2026-06-01');
  });
});

describe('dayDiff', () => {
  it('counts whole days, DST-agnostic', () => {
    expect(dayDiff('2026-03-07', '2026-03-09')).toBe(2); // spans US spring-forward
    expect(dayDiff('2026-01-01', '2026-01-01')).toBe(0);
  });
});

describe('applyCheckIn — held', () => {
  it('starts at 1 from a fresh account and sets integrity 1', () => {
    expect(applyCheckIn(ZERO_STREAK, '2026-01-10', 'held')).toEqual(
      S({ current: 1, longest: 1, lastLocalDate: '2026-01-10', lastVerdict: 'held', integrity: 1 }),
    );
  });
  it('increments on a consecutive day', () => {
    const prev = S({ current: 3, longest: 5, lastLocalDate: '2026-01-10', lastVerdict: 'held', integrity: 3 });
    expect(applyCheckIn(prev, '2026-01-11', 'held')).toEqual(
      S({ current: 4, longest: 5, lastLocalDate: '2026-01-11', lastVerdict: 'held', integrity: 4 }),
    );
  });
  it('is a no-op on a same-day repeat (verdict is locked for the day)', () => {
    const prev = S({ current: 3, lastLocalDate: '2026-01-10', lastVerdict: 'held' });
    expect(applyCheckIn(prev, '2026-01-10', 'broke')).toBe(prev);
  });
});

describe('applyCheckIn — a MISS (gap) is what punishes you', () => {
  it('resets the hold streak AND integrity to 1, and counts a reset', () => {
    const prev = S({ current: 5, longest: 5, lastLocalDate: '2026-01-10', lastVerdict: 'held', integrity: 5 });
    // gap of 3 days → a miss happened
    expect(applyCheckIn(prev, '2026-01-13', 'held')).toEqual(
      S({ current: 1, longest: 5, lastLocalDate: '2026-01-13', lastVerdict: 'held', resets: 1, integrity: 1 }),
    );
  });
});

describe('applyCheckIn — broke (honest break is cheaper than silence)', () => {
  it('zeroes the hold streak + counts a break, but KEEPS integrity when logged consecutively', () => {
    const prev = S({ current: 6, longest: 6, lastLocalDate: '2026-01-10', lastVerdict: 'held', integrity: 6 });
    const next = applyCheckIn(prev, '2026-01-11', 'broke');
    expect(next).toEqual(
      S({ current: 0, longest: 6, lastLocalDate: '2026-01-11', lastVerdict: 'broke', breaks: 1, resets: 1, integrity: 7 }),
    );
  });

  it('honesty beats going dark: a break preserves integrity; a miss destroys it', () => {
    const prev = S({ current: 4, longest: 4, lastLocalDate: '2026-01-10', lastVerdict: 'held', integrity: 10 });
    const honest = applyCheckIn(prev, '2026-01-11', 'broke'); // logged the break next day
    const silent = applyCheckIn(prev, '2026-01-13', 'held'); // went dark, resurfaced later
    expect(honest.integrity).toBe(11); // integrity protected by showing up
    expect(silent.integrity).toBe(1); // integrity destroyed by the miss
  });

  it('a break after a miss still zeroes and marks the streak lost', () => {
    const prev = S({ current: 3, lastLocalDate: '2026-01-10', lastVerdict: 'held', integrity: 3 });
    expect(applyCheckIn(prev, '2026-01-14', 'broke')).toEqual(
      S({ current: 0, lastLocalDate: '2026-01-14', lastVerdict: 'broke', breaks: 1, resets: 1, integrity: 1 }),
    );
  });
});
