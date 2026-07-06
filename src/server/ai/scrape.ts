import { tavily } from '@tavily/core';

// Ingestion-time web scraper for the coach corpus. Pulls the full cleaned text of
// curated public-domain / authoritative source pages (src/data/corpus/sources.json)
// so Voyage can embed the real teachings — actual passages from Marcus Aurelius,
// Epictetus, CBT references, etc. — instead of a hand-written summary. Server/script
// only (reads TAVILY_API_KEY); never imported by the client bundle.

export interface ScrapedPage {
  url: string;
  title: string | null;
  content: string;
}

function client() {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error('TAVILY_API_KEY is not set — needed to scrape sources for ingest.');
  return tavily({ apiKey });
}

/** Extract the full text of one or more specific pages. */
export async function extractPages(urls: string[], extractDepth: 'basic' | 'advanced' = 'basic'): Promise<ScrapedPage[]> {
  if (urls.length === 0) return [];
  const c = client();
  const out: ScrapedPage[] = [];
  const BATCH = 20;
  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH);
    const res = await c.extract(batch, { extractDepth, format: 'markdown' });
    for (const r of res.results) {
      if (r.rawContent?.trim()) out.push({ url: r.url, title: r.title ?? null, content: r.rawContent });
    }
    for (const f of res.failedResults ?? []) {
      console.warn(`    extract failed: ${f.url} — ${f.error}`);
    }
  }
  return out;
}

/** Crawl a hub page and return the text of it + its in-scope sub-pages (bounded). */
export async function crawlSite(
  url: string,
  opts: { limit?: number; maxDepth?: number; extractDepth?: 'basic' | 'advanced' } = {},
): Promise<ScrapedPage[]> {
  const c = client();
  const res = await c.crawl(url, {
    limit: opts.limit ?? 10,
    maxDepth: opts.maxDepth ?? 1,
    maxBreadth: 15,
    extractDepth: opts.extractDepth ?? 'basic',
    format: 'markdown',
    allowExternal: false,
    instructions:
      'Pages about practical philosophy and mental discipline: Stoic teachings (the dichotomy of control, amor fati, premeditatio malorum, virtue), cognitive behavioral therapy (cognitive distortions, reframing, behavioral activation), and mindfulness (present-moment focus, non-attachment, equanimity) — the principle and how to practice it.',
  });
  return (res.results ?? []).filter((r) => r.rawContent?.trim()).map((r) => ({ url: r.url, title: null, content: r.rawContent }));
}
