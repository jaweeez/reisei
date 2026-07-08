import { adminPool, vectorEnabled } from '@/server/db';
import { generateEmbeddings, toVectorLiteral } from '@/server/ai/voyage';
import { DAILY_STATES, schoolQuotes } from './schools';

// Embeddings for the Bearing's own selectable pieces (bearing_vectors, 0016), so we can score
// a school's quotes and the felt-states against a user's struggle signal. Lazy + cached: embed
// each piece once (owner role — the table is shared, no RLS), then reuse. Everything degrades to
// empty when Voyage is off, which sends resolve.ts back to the neutral date-rotated Bearing.

interface Signal {
  ref: string;
  kind: 'quote' | 'state';
  text: string;
}

/** Embed any of `items` not yet cached and upsert them (idempotent under concurrency). */
async function ensure(items: Signal[]): Promise<void> {
  if (!items.length) return;
  const p = adminPool();
  const refs = items.map((i) => i.ref);
  const have = new Set(
    (await p.query(`select ref from bearing_vectors where ref = any($1::text[])`, [refs])).rows.map((r) => r.ref as string),
  );
  const missing = items.filter((i) => !have.has(i.ref));
  if (!missing.length) return;

  const embeddings = await generateEmbeddings(missing.map((m) => m.text), 'document');
  for (let i = 0; i < missing.length; i += 1) {
    const m = missing[i]!;
    await p.query(
      `insert into bearing_vectors (ref, kind, embedding) values ($1, $2, $3::vector)
       on conflict (ref) do nothing`,
      [m.ref, m.kind, toVectorLiteral(embeddings[i]!)],
    );
  }
}

/** Cosine similarity of `vec` to each cached ref (rows only for refs that have a vector). */
async function simsFor(vec: number[], refs: string[]): Promise<{ ref: string; sim: number }[]> {
  if (!refs.length) return [];
  const rows = (
    await adminPool().query(
      `select ref, 1 - (embedding <=> $1::vector) as sim from bearing_vectors where ref = any($2::text[])`,
      [toVectorLiteral(vec), refs],
    )
  ).rows as { ref: string; sim: string | number }[];
  return rows.map((r) => ({ ref: r.ref, sim: Number(r.sim) }));
}

/** Similarity of a struggle signal to each of a school's curated quotes, keyed by quote ref. */
export async function quoteSims(ideology: string, vec: number[]): Promise<{ ref: string; sim: number }[]> {
  if (!vectorEnabled()) return [];
  const quotes = schoolQuotes(ideology);
  if (!quotes.length) return [];
  await ensure(quotes.map((q) => ({ ref: q.ref, kind: 'quote', text: `${q.text} ${q.ref}` })));
  return simsFor(vec, quotes.map((q) => q.ref));
}

/** The felt-state (from DAILY_STATES) closest to a struggle signal, or null. */
export async function bestState(vec: number[]): Promise<string | null> {
  if (!vectorEnabled()) return null;
  await ensure(DAILY_STATES.map((s) => ({ ref: s, kind: 'state', text: s })));
  const sims = await simsFor(vec, DAILY_STATES);
  if (!sims.length) return null;
  return sims.reduce((best, s) => (s.sim > best.sim ? s : best)).ref;
}
