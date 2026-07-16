/// <reference types="jest" />
import { chooseMostNovel, cosine, maxSimilarity, NOVELTY_SIM_CEILING } from './novelty';

const near = (v: number[], eps = 0.001) => v.map((x) => x + eps); // a near-identical vector

describe('cosine', () => {
  it('is 1 for identical direction, ~0 for orthogonal, safe for zero vectors', () => {
    expect(cosine([1, 0], [2, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosine([0, 0], [1, 1])).toBe(0);
  });
});

describe('maxSimilarity', () => {
  it('returns the closest match in the window, 0 when the window is empty', () => {
    expect(maxSimilarity([1, 0], [])).toBe(0);
    expect(maxSimilarity([1, 0], [[0, 1], [1, 0.01]])).toBeGreaterThan(0.99);
  });
});

describe('chooseMostNovel', () => {
  it('keeps the base read when it is already novel (no wasted re-roll)', () => {
    const base = [0, 1, 0];
    const recent = [[1, 0, 0], [0, 0, 1]]; // orthogonal to base
    const pick = chooseMostNovel([base, [1, 0, 0]], recent);
    expect(pick.index).toBe(0);
    expect(pick.novel).toBe(true);
    expect(pick.similarity).toBeLessThan(NOVELTY_SIM_CEILING);
  });

  it('rejects a near-duplicate base and takes a novel re-roll', () => {
    const recent = [[1, 0, 0]];
    const base = near([1, 0, 0]); // near-duplicate of a recent read
    const reroll = [0, 1, 0]; // novel
    const pick = chooseMostNovel([base, reroll], recent);
    expect(pick.index).toBe(1);
    expect(pick.novel).toBe(true);
  });

  it('falls back to the least-similar candidate when every option is a near-duplicate', () => {
    const recent = [[1, 0, 0]];
    const a = near([1, 0, 0], 0.0001); // extremely similar
    const b = near([1, 0, 0], 0.05); // still similar but a touch less
    const pick = chooseMostNovel([a, b], recent, 0.99);
    expect(pick.novel).toBe(false);
    expect(pick.index).toBe(1); // the least-similar of the two
  });

  it('returns index -1 for no candidates', () => {
    expect(chooseMostNovel([], [[1, 0]]).index).toBe(-1);
  });
});
