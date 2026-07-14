// Pure quote selection for the Bearing: blend the date rotation (the neutral default) with the
// profile match. At strength 0 the rotation always wins, so a user with no live struggle gets
// exactly today's date-rotated quote. As strength climbs (a fresh, clearly-matching struggle),
// a better-matching quote can take over. No DB, no AI, no env — trivially unit-testable.

export interface QuoteCandidate {
  ref: string;
  /** Cosine similarity to the struggle signal (may be negative). */
  sim: number;
}

export interface ChooseQuoteOpts {
  /** The date-rotation pick — the quiet-day default. */
  rotationRef: string;
  /** All of the school's quotes, each with its similarity to the struggle. */
  candidates: QuoteCandidate[];
  /** 0 (neutral) .. ~0.85 (a fresh, live struggle). */
  strength: number;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Choose which quote anchors today's Bearing. Rotation wins unless a candidate's normalized
 *  profile match, scaled by `strength`, strictly beats it — so quiet days stay stable and only
 *  a real, live struggle moves the pick. */
export function chooseQuoteRef({ rotationRef, candidates, strength }: ChooseQuoteOpts): string {
  if (!candidates.length) return rotationRef;
  const s = clamp01(strength);

  // Min-max normalize the matches so "best" is ~1 regardless of the raw cosine range.
  const sims = candidates.map((c) => c.sim);
  const lo = Math.min(...sims);
  const span = Math.max(...sims) - lo;
  const norm = (sim: number) => (span > 1e-9 ? (sim - lo) / span : 0);

  // Rotation's score includes its baseline advantage (1 - s); non-rotation quotes only earn
  // the match term (s * norm). Rotation is the incumbent — beat it strictly to take over.
  const rot = candidates.find((c) => c.ref === rotationRef);
  let bestRef = rotationRef;
  let bestScore = rot ? (1 - s) + s * norm(rot.sim) : -Infinity;

  for (const c of candidates) {
    if (c.ref === rotationRef) continue;
    const score = s * norm(c.sim);
    if (score > bestScore + 1e-9) {
      bestScore = score;
      bestRef = c.ref;
    }
  }
  return bestRef;
}

/** A personalized match must never make the reader see yesterday's anchor again. Prefer the
 * date rotation when it differs; if it does not, take the next distinct curated quote. */
export function avoidConsecutiveQuoteRef(
  preferredRef: string,
  rotationRef: string,
  candidates: QuoteCandidate[],
  previousRef: string | null,
): string {
  if (!previousRef || preferredRef !== previousRef) return preferredRef;
  if (rotationRef !== previousRef && candidates.some((c) => c.ref === rotationRef)) return rotationRef;

  const start = Math.max(candidates.findIndex((c) => c.ref === preferredRef), 0);
  for (let offset = 1; offset < candidates.length; offset += 1) {
    const candidate = candidates[(start + offset) % candidates.length];
    if (candidate && candidate.ref !== previousRef) return candidate.ref;
  }
  return preferredRef; // A one-quote school has no distinct alternative.
}
