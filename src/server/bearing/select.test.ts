/// <reference types="jest" />
import { chooseQuoteRef, selectUnusedQuoteRef, type QuoteCandidate } from './select';

// The school's quotes with their similarity to a struggle signal. "b" is the clear match.
const CANDIDATES: QuoteCandidate[] = [
  { ref: 'a', sim: 0.10 },
  { ref: 'b', sim: 0.90 }, // strongly matches the struggle
  { ref: 'c', sim: 0.20 },
];
const ROTATION = 'a'; // today's date-rotation pick

describe('chooseQuoteRef', () => {
  it('returns the rotation pick at strength 0 (a user with no live struggle sees today\'s quote)', () => {
    expect(chooseQuoteRef({ rotationRef: ROTATION, candidates: CANDIDATES, strength: 0 })).toBe('a');
  });

  it('never leaves the rotation pick when the rotation IS the best match, regardless of strength', () => {
    const cands: QuoteCandidate[] = [
      { ref: 'a', sim: 0.95 },
      { ref: 'b', sim: 0.1 },
    ];
    expect(chooseQuoteRef({ rotationRef: 'a', candidates: cands, strength: 0.85 })).toBe('a');
  });

  it('overrides to the clearly-better-matching quote when a struggle is fresh (high strength)', () => {
    expect(chooseQuoteRef({ rotationRef: ROTATION, candidates: CANDIDATES, strength: 0.85 })).toBe('b');
  });

  it('scales with strength: rotation holds when weak, the match wins once strong enough', () => {
    const weak = chooseQuoteRef({ rotationRef: ROTATION, candidates: CANDIDATES, strength: 0.2 });
    const strong = chooseQuoteRef({ rotationRef: ROTATION, candidates: CANDIDATES, strength: 0.8 });
    expect(weak).toBe('a'); // slight signal does not disturb the day's quote
    expect(strong).toBe('b'); // a live struggle does
  });

  it('is monotonic: once the match takes over it does not flip back at higher strength', () => {
    const refs = [0.5, 0.6, 0.7, 0.8, 0.9, 1].map((s) =>
      chooseQuoteRef({ rotationRef: ROTATION, candidates: CANDIDATES, strength: s }),
    );
    const firstB = refs.indexOf('b');
    expect(firstB).toBeGreaterThanOrEqual(0);
    expect(refs.slice(firstB).every((r) => r === 'b')).toBe(true);
  });

  it('falls back to the rotation ref when there are no candidates', () => {
    expect(chooseQuoteRef({ rotationRef: 'z', candidates: [], strength: 0.85 })).toBe('z');
  });

  it('handles flat similarities (no clear match) by keeping the rotation pick', () => {
    const flat: QuoteCandidate[] = [
      { ref: 'a', sim: 0.4 },
      { ref: 'b', sim: 0.4 },
    ];
    expect(chooseQuoteRef({ rotationRef: 'a', candidates: flat, strength: 0.85 })).toBe('a');
  });
});

describe('selectUnusedQuoteRef', () => {
  it('keeps the personalized anchor when the reader has not seen it', () => {
    expect(selectUnusedQuoteRef('b', 'a', CANDIDATES, new Set(['a']))).toBe('b');
  });

  it('falls back to a different unshown quote when the profile match is already used', () => {
    expect(selectUnusedQuoteRef('b', 'a', CANDIDATES, new Set(['b']))).toBe('a');
  });

  it('never reuses a quote after every candidate has been seen', () => {
    expect(selectUnusedQuoteRef('a', 'a', CANDIDATES, new Set(['a', 'b', 'c']))).toBeNull();
  });
});
