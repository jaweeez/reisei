import { randomUUID } from 'node:crypto';
import { adminPool } from './db';
import { crawlSite, extractPages } from './ai/scrape';
import { chunkText } from './chunk';
import { embedDocuments, toVectorLiteral } from './ai/voyage';
import type { CorpusSource } from '../data/corpus/types';

// Scrape + chunk + embed a SINGLE corpus source into teaching_chunks. Bounded so it
// fits a serverless request (a future admin "add source" action). A full re-scrape of
// every source is `npm run ingest`. Repurposed from Enso's ingestOne.ts.

const MAX_CHUNKS_PER_PAGE = 30;

export async function ingestOneSource(src: CorpusSource): Promise<number> {
  const pages =
    src.action === 'crawl-basic'
      ? await crawlSite(src.url, { limit: 10, maxDepth: 1 })
      : src.action === 'crawl-deep'
        ? await crawlSite(src.url, { limit: 25, maxDepth: 2 })
        : await extractPages([src.url]);

  const docs: { url: string; title: string | null; inputs: string[] }[] = [];
  for (const pg of pages) {
    const chunks = chunkText(pg.content).map((c) => c.content).slice(0, MAX_CHUNKS_PER_PAGE);
    if (!chunks.length) continue;
    const header = `${src.org} — ${pg.title ?? src.title} (${src.ideology}). Source: ${pg.url}`;
    docs.push({ url: pg.url, title: pg.title ?? src.title, inputs: chunks.map((ch) => `${header}\n\n${ch}`) });
  }

  const p = adminPool();
  await p.query(`delete from teaching_chunks where ref_kind = 'web' and ref_id = $1`, [src.id]);
  if (!docs.length) return 0;

  const vectors = await embedDocuments(docs.map((d) => d.inputs), 'document');
  let inserted = 0;
  for (let i = 0; i < docs.length; i += 1) {
    const d = docs[i]!;
    const dv = vectors[i]!;
    for (let j = 0; j < d.inputs.length; j += 1) {
      await p.query(
        `insert into teaching_chunks (id, ref_kind, ref_id, ideology, theme, title, url, content, embedding)
         values ($1,'web',$2,$3,$4,$5,$6,$7,$8::vector)`,
        [randomUUID(), src.id, src.ideology, src.theme ?? null, d.title, d.url, d.inputs[j], toVectorLiteral(dv[j]!)],
      );
      inserted += 1;
    }
  }
  return inserted;
}
