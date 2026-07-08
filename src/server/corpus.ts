// Server-side view of the curated coach corpus. Reads the app's CANONICAL
// src/data/corpus/teachings.json (via ../data/corpus). Relative import (not the @/
// alias) so the CLI scripts run under tsx without alias resolution. Only imported by
// API routes + scripts → never in the client bundle. Repurposed from Enso's catalog.ts.
import { corpus } from '../data/corpus';

export interface TeachingChunk {
  ref_kind: 'teaching';
  ref_id: string;
  ideology: string;
  theme: string;
  title: string;
  url: string | null;
  content: string;
}

/** Flatten the curated teachings into embeddable passages (ingest + keyword fallback). */
export function teachingsToChunks(): TeachingChunk[] {
  return corpus.teachings.map((t) => {
    const parts = [
      `${t.title} (${t.ideology}, ${t.theme}).`,
      t.teaching,
      `Practice: ${t.practice}`,
      t.source ? `— ${t.source}` : '',
    ].filter(Boolean);
    return {
      ref_kind: 'teaching' as const,
      ref_id: t.id,
      ideology: t.ideology,
      theme: t.theme,
      title: t.title,
      url: t.url ?? null,
      content: parts.join(' '),
    };
  });
}
