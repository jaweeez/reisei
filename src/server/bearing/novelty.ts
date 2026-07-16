// Cross-school no-repeat for generated Bearing reads (docs/RECOVERY_EXPANSION.md, hard requirement).
// Pure vector math: no DB, no AI, trivially unit-testable. resolve.ts supplies the candidate read
// embeddings (a base read plus any re-rolls) and the reader's recent read embeddings across ALL
// their schools; this picks the most novel candidate. A reader who follows AA and NA must never get
// two near-identical reads on the same day, and no read should repeat within the recent window.

export const NOVELTY_SIM_CEILING = 0.9; // cosine at or above this counts as a near-duplicate to avoid
export const NOVELTY_WINDOW = 45; // how many recent reads to check a candidate against

/** Cosine similarity of two vectors. 0 when either is zero-length (degrades safely). */
export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** The highest cosine similarity of `candidate` to any of the `recent` read vectors (0 when none). */
export function maxSimilarity(candidate: number[], recent: number[][]): number {
  let m = 0;
  for (const r of recent) {
    const s = cosine(candidate, r);
    if (s > m) m = s;
  }
  return m;
}

export interface NoveltyPick {
  /** Index into `candidates` to use (-1 when there are none). */
  index: number;
  /** The chosen candidate's max similarity to the recent window. */
  similarity: number;
  /** True when the chosen candidate is under the ceiling (genuinely novel). */
  novel: boolean;
}

/** Choose the most novel candidate. Candidates are tried in order, so a base read that is already
 *  under the ceiling wins immediately with no wasted re-rolls. If every candidate is at or above the
 *  ceiling, the least-similar one is returned with `novel: false` (the caller accepts it as the best
 *  available). Empty candidates → index -1. */
export function chooseMostNovel(
  candidates: number[][],
  recent: number[][],
  ceiling = NOVELTY_SIM_CEILING,
): NoveltyPick {
  if (!candidates.length) return { index: -1, similarity: 0, novel: false };
  let best: NoveltyPick = { index: 0, similarity: Infinity, novel: false };
  for (let i = 0; i < candidates.length; i += 1) {
    const sim = maxSimilarity(candidates[i]!, recent);
    if (sim < ceiling) return { index: i, similarity: sim, novel: true };
    if (sim < best.similarity) best = { index: i, similarity: sim, novel: false };
  }
  return best;
}
