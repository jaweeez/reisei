import { tavily } from '@tavily/core';

// Live web search for the coach's optional webSearch tool and the ingestion crawl.
// sourceDomainsFor pins an ideology-scoped search to authoritative / public-domain
// texts. Returns null when TAVILY_API_KEY isn't set, so the coach degrades
// gracefully to the curated corpus + keyword fallback.

export interface TavilyResultLite {
  answer: string | null;
  results: { title: string; url: string; content: string }[];
}

/** Authoritative source domains to pin an ideology-scoped search to. */
export function sourceDomainsFor(ideology?: string): string[] {
  switch (ideology) {
    case 'stoicism':
      return ['classics.mit.edu', 'standardebooks.org', 'dailystoic.com', 'plato.stanford.edu', 'iep.utm.edu'];
    case 'cbt':
      return ['apa.org', 'psychologytools.com', 'nhs.uk', 'verywellmind.com', 'beckinstitute.org'];
    case 'mindfulness':
      return ['mindful.org', 'accesstoinsight.org', 'plato.stanford.edu', 'greatergood.berkeley.edu'];
    default:
      return ['plato.stanford.edu', 'iep.utm.edu', 'apa.org'];
  }
}

export async function tavilySearch(
  query: string,
  opts: { searchDepth?: 'basic' | 'advanced'; includeDomains?: string[]; maxResults?: number } = {},
): Promise<TavilyResultLite | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;
  try {
    const client = tavily({ apiKey });
    const res = await client.search(query, {
      searchDepth: opts.searchDepth ?? 'basic',
      includeDomains: opts.includeDomains,
      maxResults: opts.maxResults ?? 5,
      includeAnswer: true,
    });
    return {
      answer: (res.answer as string) ?? null,
      results: (res.results ?? []).map((r) => ({ title: r.title, url: r.url, content: r.content })),
    };
  } catch {
    return null;
  }
}
