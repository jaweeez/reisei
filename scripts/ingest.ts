import { config } from 'dotenv';
// Expo/Metro auto-loads .env.local; standalone tsx scripts do not.
config({ path: '.env.local' });
config({ path: '.env' });
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { adminPool as pool } from '../src/server/db';
import { teachingsToChunks } from '../src/server/corpus';
import { generateEmbeddings, embedDocuments, toVectorLiteral } from '../src/server/ai/voyage';
import { crawlSite, extractPages, type ScrapedPage } from '../src/server/ai/scrape';
import { chunkText } from '../src/server/chunk';
import { corpus } from '../src/data/corpus';

// Ingestion pipeline: (1) embed the curated teachings (the always-on backbone), then
// (2) SCRAPE the curated public-domain / authoritative sources with Tavily, chunk +
// embed the real page text as ref_kind='web'. The coach retrieves across both.
// Idempotent: each kind is deleted + reinserted. Repurposed from Enso's ingest.ts.
//
//   npm run ingest                 full: curated teachings + web scrape
//   npm run ingest -- --curated-only   just the curated teachings
//   INGEST_SCRAPE_CACHE=path        cache raw scraped pages so retries don't re-scrape

const CRAWL_LIMITS: Record<'crawl-basic' | 'crawl-deep', { limit: number; maxDepth: number }> = {
  'crawl-basic': { limit: 10, maxDepth: 1 },
  'crawl-deep': { limit: 25, maxDepth: 2 },
};
const MAX_CHUNKS_PER_PAGE = 30;
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

type Source = (typeof corpus.sources)[number];
interface RawPage { id: string; url: string; title: string | null; content: string }

async function scrapeSource(s: Source): Promise<ScrapedPage[]> {
  if (s.action === 'crawl-basic' || s.action === 'crawl-deep') return crawlSite(s.url, CRAWL_LIMITS[s.action]);
  return extractPages([s.url]);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  if (!process.env.VOYAGE_API_KEY && !process.env.VOYAGE_AI_API_KEY) {
    console.error('Missing VOYAGE_API_KEY (or VOYAGE_AI_API_KEY). Add it before running so real embeddings are generated.');
    process.exit(1);
  }
  const scrapeEnabled = Boolean(process.env.TAVILY_API_KEY);
  const cachePath = process.env.INGEST_SCRAPE_CACHE;
  const p = pool();

  const insert = (row: { ref_kind: string; ref_id: string; ideology: string | null; theme: string | null; title: string | null; url: string | null; content: string; vec: string }) =>
    p.query(
      `insert into teaching_chunks (id, ref_kind, ref_id, ideology, theme, title, url, content, embedding)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::vector)`,
      [randomUUID(), row.ref_kind, row.ref_id, row.ideology, row.theme, row.title, row.url, row.content, row.vec],
    );

  // ── 1) Curated teachings → the hand-written backbone ──
  const curated = teachingsToChunks();
  await p.query(`delete from teaching_chunks where ref_kind = 'teaching'`);
  console.log(`Embedding ${curated.length} curated teachings via Voyage…`);
  const vecs = await generateEmbeddings(curated.map((c) => c.content), 'document');
  for (let i = 0; i < curated.length; i += 1) {
    const c = curated[i]!;
    await insert({ ref_kind: 'teaching', ref_id: c.ref_id, ideology: c.ideology, theme: c.theme, title: c.title, url: c.url, content: c.content, vec: toVectorLiteral(vecs[i]!) });
  }
  console.log(`  → ${curated.length} curated chunks seeded.`);

  if (process.argv.includes('--curated-only')) {
    console.log('--curated-only: leaving existing web chunks in place.');
    await p.end();
    return;
  }
  if (!scrapeEnabled) {
    await p.query(`delete from teaching_chunks where ref_kind = 'web'`);
    console.log('TAVILY_API_KEY not set — skipping web scrape (curated teachings only).');
    await p.end();
    return;
  }

  // ── 2) Web sources → scrape (cache-backed) → chunk → embed as ref_kind='web' ──
  const sources = corpus.sources;
  const byId = new Map(sources.map((s) => [s.id, s]));
  let raw: RawPage[];
  if (cachePath && existsSync(cachePath)) {
    raw = JSON.parse(readFileSync(cachePath, 'utf8')) as RawPage[];
    console.log(`\nLoaded ${raw.length} cached scraped pages from ${cachePath} (no re-scrape).`);
  } else {
    console.log(`\nScraping ${sources.length} curated sources with Tavily…`);
    raw = [];
    let failed = 0;
    for (const s of sources) {
      try {
        const pages = await scrapeSource(s);
        for (const pg of pages) raw.push({ id: s.id, url: pg.url, title: pg.title, content: pg.content });
        console.log(`  ✓ ${s.id} (${s.action}) — ${pages.length} page(s)`);
      } catch (e) {
        failed += 1;
        console.warn(`  ✗ ${s.id} — ${msg(e)}`);
      }
    }
    console.log(`Scraped ${raw.length} page(s) from ${sources.length} sources (${failed} failed).`);
    if (cachePath) {
      writeFileSync(cachePath, JSON.stringify(raw));
      console.log(`Cached raw pages to ${cachePath}.`);
    }
  }

  const docs: { id: string; url: string; title: string | null; inputs: string[] }[] = [];
  for (const pg of raw) {
    const s = byId.get(pg.id);
    if (!s) continue;
    const all = chunkText(pg.content).map((c) => c.content);
    const cs = all.slice(0, MAX_CHUNKS_PER_PAGE);
    if (all.length > cs.length) console.log(`  capped ${pg.url} at ${cs.length}/${all.length} chunks`);
    if (!cs.length) continue;
    const header = `${s.org} — ${pg.title ?? s.title} (${s.ideology}). Source: ${pg.url}`;
    docs.push({ id: s.id, url: pg.url, title: pg.title ?? s.title, inputs: cs.map((ch) => `${header}\n\n${ch}`) });
  }

  const totalChunks = docs.reduce((n, d) => n + d.inputs.length, 0);
  console.log(`\nEmbedding ${totalChunks} web chunks from ${docs.length} pages…`);
  const webVecs = await embedDocuments(docs.map((d) => d.inputs), 'document');

  await p.query(`delete from teaching_chunks where ref_kind = 'web'`);
  let webInserted = 0;
  for (let i = 0; i < docs.length; i += 1) {
    const d = docs[i]!;
    const dv = webVecs[i]!;
    const s = byId.get(d.id)!;
    for (let j = 0; j < d.inputs.length; j += 1) {
      await insert({ ref_kind: 'web', ref_id: d.id, ideology: s.ideology, theme: s.theme ?? null, title: d.title, url: d.url, content: d.inputs[j]!, vec: toVectorLiteral(dv[j]!) });
      webInserted += 1;
    }
  }

  console.log(`\nSeeded ${curated.length} curated + ${webInserted} web chunks.`);
  await p.end();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
