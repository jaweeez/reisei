/// <reference types="jest" />
import { corpus } from '@/data/corpus';
import { SOURCE_REFRESH_INTERVAL_DAYS, selectNextDueSource, sourceIsDue } from './sourceRefresh';

describe('sourceIsDue', () => {
  const now = new Date('2026-07-14T12:00:00Z');

  it('refreshes sources that have never succeeded', () => {
    expect(sourceIsDue(null, now)).toBe(true);
  });

  it('waits for the full 89-day interval', () => {
    const recent = new Date(now.getTime() - (SOURCE_REFRESH_INTERVAL_DAYS - 1) * 86_400_000);
    expect(sourceIsDue(recent, now)).toBe(false);
  });

  it('makes a source due again on day 89', () => {
    const due = new Date(now.getTime() - SOURCE_REFRESH_INTERVAL_DAYS * 86_400_000);
    expect(sourceIsDue(due, now)).toBe(true);
  });
});

describe('selectNextDueSource', () => {
  it('staggers a fully due corpus across schools on consecutive days', () => {
    const first = selectNextDueSource(corpus.sources, [], new Date('2026-07-14T12:00:00Z'));
    const next = selectNextDueSource(corpus.sources, [], new Date('2026-07-15T12:00:00Z'));
    expect(first).not.toBeNull();
    expect(next).not.toBeNull();
    expect(first?.ideology).not.toBe(next?.ideology);
  });

  it('uses the least-recently refreshed due source within the scheduled school', () => {
    const now = new Date('2026-07-14T12:00:00Z');
    const first = selectNextDueSource(corpus.sources, [], now);
    expect(first).not.toBeNull();
    const sameSchool = corpus.sources.filter((source) => source.ideology === first!.ideology);
    if (sameSchool.length < 2) return;
    const states = sameSchool.map((source, index) => ({
      source_id: source.id,
      last_success_at: new Date(now.getTime() - (SOURCE_REFRESH_INTERVAL_DAYS + index) * 86_400_000),
    }));
    const selected = selectNextDueSource(corpus.sources, states, now);
    expect(selected?.id).toBe(sameSchool[sameSchool.length - 1]!.id);
  });
});
