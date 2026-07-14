import type { Pool, PoolClient } from 'pg';
import { corpus } from '@/data/corpus';
import { chunkText } from '@/server/chunk';
import { embedDocuments, toVectorLiteral } from '@/server/ai/voyage';
import { crawlSite, extractPages, type ScrapedPage } from '@/server/ai/scrape';

/** Each approved source is refreshed at least this often. The cron runs daily and does one
 * source at a time to keep the work safely inside a serverless invocation. */
export const SOURCE_REFRESH_INTERVAL_DAYS = 89;
const MAX_CHUNKS_PER_SOURCE = 24;
const CRAWL_LIMITS = {
  'crawl-basic': { limit: 10, maxDepth: 1 },
  'crawl-deep': { limit: 24, maxDepth: 2 },
} as const;

type CorpusSource = (typeof corpus.sources)[number];

export interface SourceRefreshResult {
  sourceId: string | null;
  refreshed: boolean;
  due: boolean;
  chunks: number;
  error?: string;
}

export type RefreshState = { source_id: string; last_success_at: Date | null };
type SourceDocument = { title: string; url: string; inputs: string[] };

export function sourceIsDue(lastSuccessAt: Date | null, now = new Date()): boolean {
  if (!lastSuccessAt) return true;
  return now.getTime() - lastSuccessAt.getTime() >= SOURCE_REFRESH_INTERVAL_DAYS * 86_400_000;
}

/**
 * Pick one due source without running through a single school in a batch. The starting school
 * moves forward every UTC day, so a healthy corpus gets one source from each school before the
 * rotation comes back around. Within a school, the least-recently refreshed source wins.
 */
export function selectNextDueSource(
  sources: readonly CorpusSource[],
  states: readonly RefreshState[],
  now = new Date(),
): CorpusSource | null {
  const byId = new Map(states.map((state) => [state.source_id, state]));
  const due = sources.filter((source) => sourceIsDue(byId.get(source.id)?.last_success_at ?? null, now));
  if (!due.length) return null;

  const ideologies = [...new Set(sources.map((source) => source.ideology))].sort();
  const day = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86_400_000);
  const start = ((day % ideologies.length) + ideologies.length) % ideologies.length;

  for (let offset = 0; offset < ideologies.length; offset += 1) {
    const ideology = ideologies[(start + offset) % ideologies.length]!;
    const candidates = due
      .filter((source) => source.ideology === ideology)
      .sort((a, b) => {
        const aTime = byId.get(a.id)?.last_success_at?.getTime() ?? 0;
        const bTime = byId.get(b.id)?.last_success_at?.getTime() ?? 0;
        return aTime - bTime || a.id.localeCompare(b.id);
      });
    if (candidates[0]) return candidates[0];
  }
  return null;
}

async function scrapeSource(source: CorpusSource): Promise<ScrapedPage[]> {
  if (source.action === 'crawl-basic' || source.action === 'crawl-deep') {
    return crawlSite(source.url, CRAWL_LIMITS[source.action]);
  }
  return extractPages([source.url]);
}

function toDocuments(source: CorpusSource, pages: ScrapedPage[]): SourceDocument[] {
  let remaining = MAX_CHUNKS_PER_SOURCE;
  const docs: SourceDocument[] = [];
  for (const page of pages) {
    if (remaining <= 0) break;
    const chunks = chunkText(page.content).slice(0, remaining).map((chunk) => {
      const title = page.title ?? source.title;
      return `${source.org} — ${title} (${source.ideology}). Source: ${page.url}\n\n${chunk.content}`;
    });
    if (!chunks.length) continue;
    docs.push({ title: page.title ?? source.title, url: page.url, inputs: chunks });
    remaining -= chunks.length;
  }
  return docs;
}

async function replaceSourceChunks(client: PoolClient, source: CorpusSource, docs: SourceDocument[]): Promise<number> {
  const vectors = await embedDocuments(docs.map((doc) => doc.inputs), 'document');
  const count = docs.reduce((total, doc) => total + doc.inputs.length, 0);
  if (!count) throw new Error('No usable source passages found.');

  await client.query('begin');
  try {
    await client.query(`delete from teaching_chunks where ref_kind = 'web' and ref_id = $1`, [source.id]);
    for (let i = 0; i < docs.length; i += 1) {
      const doc = docs[i]!;
      const docVectors = vectors[i]!;
      for (let j = 0; j < doc.inputs.length; j += 1) {
        await client.query(
          `insert into teaching_chunks (ref_kind, ref_id, ideology, theme, title, url, content, embedding)
           values ('web', $1, $2, $3, $4, $5, $6, $7::vector)`,
          [source.id, source.ideology, source.theme ?? null, doc.title, doc.url, doc.inputs[j], toVectorLiteral(docVectors[j]!)],
        );
      }
    }
    await client.query('commit');
    return count;
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}

/** Refresh the next approved source that has not succeeded within 89 days. The old source data
 * remains in place if scrape or embedding fails, and the failed source is retried tomorrow. */
export async function refreshNextDueSource(client: PoolClient, now = new Date()): Promise<SourceRefreshResult> {
  const states = (await client.query(`select source_id, last_success_at from corpus_source_refreshes`)).rows as RefreshState[];
  const source = selectNextDueSource(corpus.sources, states, now);
  if (!source) return { sourceId: null, refreshed: false, due: false, chunks: 0 };

  await client.query(
    `insert into corpus_source_refreshes (source_id, last_attempt_at)
     values ($1, now())
     on conflict (source_id) do update set last_attempt_at = now(), last_error = null`,
    [source.id],
  );

  try {
    const docs = toDocuments(source, await scrapeSource(source));
    const chunks = await replaceSourceChunks(client, source, docs);
    await client.query(
      `update corpus_source_refreshes
          set last_success_at = now(), chunk_count = $2, last_error = null
        where source_id = $1`,
      [source.id, chunks],
    );
    return { sourceId: source.id, refreshed: true, due: true, chunks };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500);
    await client.query(`update corpus_source_refreshes set last_error = $2 where source_id = $1`, [source.id, message]);
    return { sourceId: source.id, refreshed: false, due: true, chunks: 0, error: message };
  }
}

/** Serialize refresh work across the daily Bearing job and the protected manual endpoint. */
export async function refreshNextDueSourceLocked(pool: Pool, now = new Date()): Promise<SourceRefreshResult> {
  const client = await pool.connect();
  let locked = false;
  try {
    const lock = (await client.query(`select pg_try_advisory_lock(8920147) as locked`)).rows[0] as { locked?: boolean } | undefined;
    locked = !!lock?.locked;
    if (!locked) return { sourceId: null, refreshed: false, due: false, chunks: 0 };
    return await refreshNextDueSource(client, now);
  } finally {
    if (locked) await client.query(`select pg_advisory_unlock(8920147)`).catch(() => undefined);
    client.release();
  }
}
