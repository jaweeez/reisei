import { pool, vectorEnabled } from '../db';
import { teachingsToChunks } from '../corpus';
import { generateEmbedding, toVectorLiteral } from './voyage';

// Retrieval for the coach. Full mode (Postgres + Voyage): pgvector cosine search over
// teaching_chunks. Fallback (no Voyage key): keyword scoring over the bundled curated
// teachings, so the coach works end-to-end before the vector store is ingested.
// Repurposed from Enso's vector.ts (searchResources → searchTeachings; state → ideology).

const SIMILARITY_FLOOR = 0.3;

export interface RetrievedTeaching {
  ref_id: string | null;
  title: string | null;
  url: string | null;
  ideology: string | null;
  theme: string | null;
  content: string;
  similarity: number;
}

/** Cap how many chunks come from any one source so the coach sees variety. Rows arrive best-first. */
function diversify(rows: RetrievedTeaching[], limit: number, perSource = 2): RetrievedTeaching[] {
  const seen = new Map<string, number>();
  const out: RetrievedTeaching[] = [];
  for (const r of rows) {
    const key = r.ref_id ?? r.url ?? r.title ?? '';
    const n = seen.get(key) ?? 0;
    if (n >= perSource) continue;
    seen.set(key, n + 1);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

/** Retrieve grounding teachings for the coach, optionally scoped to one ideology. */
export async function searchTeachings(query: string, ideology?: string, limit = 6): Promise<RetrievedTeaching[]> {
  if (vectorEnabled()) {
    try {
      const vec = toVectorLiteral(await generateEmbedding(query, 'query'));
      const p = pool();
      const fetchN = Math.max(limit * 4, 24);
      const raw = ideology
        ? await p.query(
            `SELECT ref_id, title, url, ideology, theme, content,
                    1 - (embedding <=> $1::vector) AS similarity
             FROM teaching_chunks
             WHERE ideology = $2
             ORDER BY embedding <=> $1::vector
             LIMIT $3`,
            [vec, ideology, fetchN],
          )
        : await p.query(
            `SELECT ref_id, title, url, ideology, theme, content,
                    1 - (embedding <=> $1::vector) AS similarity
             FROM teaching_chunks
             ORDER BY embedding <=> $1::vector
             LIMIT $2`,
            [vec, fetchN],
          );
      const relevant = (raw.rows as RetrievedTeaching[]).filter((r) => (r.similarity ?? 0) >= SIMILARITY_FLOOR);
      return diversify(relevant, limit);
    } catch {
      // fall through to keyword search rather than dropping the coach
    }
  }
  return keywordSearch(query, ideology, limit);
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'you', 'your', 'with', 'how', 'can', 'what', 'are', 'get', 'that', 'this',
  'have', 'need', 'about', 'from', 'they', 'them', 'their', 'was', 'but', 'not', 'today',
]);
function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function keywordSearch(query: string, ideology: string | undefined, limit: number): RetrievedTeaching[] {
  const chunks = teachingsToChunks().filter((c) => !ideology || c.ideology === ideology);
  const terms = tokenize(query);
  const scored = chunks
    .map((c) => {
      const hay = `${c.title} ${c.content} ${c.theme}`.toLowerCase();
      return { c, score: terms.reduce((n, t) => (hay.includes(t) ? n + 1 : n), 0) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  const chosen = scored.length ? scored : chunks.slice(0, Math.min(limit, 4)).map((c) => ({ c, score: 0 }));
  return chosen.map(({ c }) => ({
    ref_id: c.ref_id, title: c.title, url: c.url, ideology: c.ideology, theme: c.theme, content: c.content, similarity: 0,
  }));
}
