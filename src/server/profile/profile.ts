import { vectorEnabled, withUser } from '@/server/db';
import { generateEmbedding, toVectorLiteral } from '@/server/ai/voyage';
import { screenEntry } from './safety';

// The ambient profile. Every non-dark log entry is embedded (Voyage) and folded into a
// long-run centroid (user_profiles, 0015). The responsive "what's live right now" signal is
// computed on demand from the most recent embedded entries, recency-weighted and faded by age
// so a struggle from this week steers hard and one from last month barely at all. All of this
// only tunes the Bearing (src/server/bearing/resolve.ts); it is never shown to the user.
//
// Cosine distance (pgvector <=>) ignores magnitude, so none of these vectors are normalized.

const EMA_ALPHA = 0.2; // long-run centroid: slow, stable backdrop
const RECENCY_WEIGHTS = [1, 0.6, 0.36]; // newest entry leads the struggle signal
const FRESH_DAYS = 3; // within this, a struggle is at full strength
const FADE_DAYS = 21; // by this, it has faded to nothing
const MAX_STRENGTH = 0.85; // ceiling on how far a fresh struggle can pull the Bearing
const BASELINE_STRENGTH = 0.3; // gentle pull from the long-run profile when nothing is fresh

export interface StruggleSignal {
  /** The direction to steer toward (compare with cosine; not normalized). */
  vec: number[];
  /** 0 (neutral, use the date rotation) → ~0.85 (a fresh, live struggle). */
  strength: number;
}

function parseVector(v: unknown): number[] | null {
  if (Array.isArray(v)) return v as number[];
  if (typeof v === 'string') {
    try {
      const a = JSON.parse(v);
      return Array.isArray(a) ? (a as number[]) : null;
    } catch {
      return null;
    }
  }
  return null;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Recency-weighted average of a few recent vectors (weights normalized; direction preserved). */
function weightedMean(vecs: number[][], weights: number[]): number[] {
  const dim = vecs[0]!.length;
  const out = new Array<number>(dim).fill(0);
  let wsum = 0;
  vecs.forEach((v, i) => {
    const w = weights[i] ?? 0;
    wsum += w;
    for (let j = 0; j < dim; j += 1) out[j]! += w * (v[j] ?? 0);
  });
  if (wsum > 0) for (let j = 0; j < dim; j += 1) out[j]! /= wsum;
  return out;
}

/** EMA blend of the prior centroid toward a new embedding (seeds on the first entry). */
function emaBlend(prev: number[] | null, next: number[], alpha: number): number[] {
  if (!prev || prev.length !== next.length) return next.slice();
  return prev.map((p, i) => (1 - alpha) * p + alpha * next[i]!);
}

/** Screen, embed, and fold one entry into the profile. Best-effort: returns `{ offramp }` and
 *  never throws for a Voyage/model failure (the entry is already saved by the caller). A `dark`
 *  entry is left with a null embedding, so it is excluded from the centroid and the struggle
 *  signal, and the caller shows an off-ramp instead. */
export async function ingestEntry(userId: string, entryId: string, text: string): Promise<{ offramp: boolean }> {
  const risk = await screenEntry(text);
  if (risk === 'dark') return { offramp: true };
  if (!vectorEnabled()) return { offramp: false };

  let emb: number[];
  try {
    emb = await generateEmbedding(text, 'document');
  } catch (e) {
    console.error('journal embed error:', e instanceof Error ? e.message : e);
    return { offramp: false };
  }
  const embLit = toVectorLiteral(emb);

  await withUser(userId, async (c) => {
    await c.query(`update journal_entries set embedding = $1::vector where id = $2 and user_id = current_app_user()`, [
      embLit,
      entryId,
    ]);
    const prevRow = (await c.query(`select centroid from user_profiles where user_id = current_app_user()`)).rows[0] as
      | { centroid: unknown }
      | undefined;
    const centroid = emaBlend(prevRow ? parseVector(prevRow.centroid) : null, emb, EMA_ALPHA);
    await c.query(
      `insert into user_profiles (user_id, centroid, entries_count, last_entry_at, updated_at)
       values (current_app_user(), $1::vector, 1, now(), now())
       on conflict (user_id) do update set
         centroid = $1::vector,
         entries_count = user_profiles.entries_count + 1,
         last_entry_at = now(),
         updated_at = now()`,
      [toVectorLiteral(centroid)],
    );
  });

  return { offramp: false };
}

/** The signal the Bearing steers by. Recent embedded entries (recency-weighted) when a struggle
 *  is fresh; the long-run centroid at a low baseline otherwise; null when there's nothing to go
 *  on. `strength` is what makes the pull "slight when quiet, strong when something's live." */
export async function struggleVector(userId: string): Promise<StruggleSignal | null> {
  if (!vectorEnabled()) return null;

  return withUser(userId, async (c) => {
    const rows = (
      await c.query(
        `select embedding, extract(epoch from (now() - created_at)) / 86400.0 as age_days
           from journal_entries
          where user_id = current_app_user() and embedding is not null
          order by created_at desc
          limit 3`,
      )
    ).rows as { embedding: unknown; age_days: string | number }[];

    const recent = rows
      .map((r) => ({ vec: parseVector(r.embedding), age: Number(r.age_days) }))
      .filter((r): r is { vec: number[]; age: number } => r.vec !== null);

    if (recent.length) {
      const newestAge = recent[0]!.age;
      const fade = clamp01((FADE_DAYS - newestAge) / (FADE_DAYS - FRESH_DAYS));
      if (fade > 0) {
        const vec = weightedMean(recent.map((r) => r.vec), RECENCY_WEIGHTS);
        return { vec, strength: MAX_STRENGTH * fade };
      }
    }

    // Nothing fresh — fall back to the long-run profile at a gentle baseline.
    const prof = (await c.query(`select centroid from user_profiles where user_id = current_app_user()`)).rows[0] as
      | { centroid: unknown }
      | undefined;
    const centroid = prof ? parseVector(prof.centroid) : null;
    return centroid ? { vec: centroid, strength: BASELINE_STRENGTH } : null;
  });
}
