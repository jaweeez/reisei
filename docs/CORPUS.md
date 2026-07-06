# Coach corpus (RAG pipeline)

The coach grounds its terse nudges in real teachings from mental-health ideologies
(Stoicism, CBT, mindfulness…). Ported from Enso's Tavily→Voyage→Claude pipeline and
repurposed from "recovery resources by US state" → "teachings by ideology".

```
curated teachings ─┐
                   ├─ Voyage (voyage-context-4, 1024-dim) ─→ teaching_chunks (pgvector)
Tavily scrape ─────┘                                              │
                                                                  ▼
POST /api/coach ──→ searchTeachings(situation, ideology) ──→ Claude ──→ terse nudge
```

## Pieces

| File | Role |
|---|---|
| `src/data/corpus/teachings.json` | Curated teachings + web sources (the seed corpus) |
| `src/data/corpus/types.ts` | `Ideology`, `Teaching`, `CorpusSource` + labels |
| `src/server/corpus.ts` | Flatten curated teachings → embeddable chunks |
| `src/server/ai/voyage.ts` | Contextualized embeddings (1024-dim) |
| `src/server/ai/scrape.ts` · `tavily.ts` | Tavily extract/crawl + ideology domain pinning |
| `src/server/chunk.ts` | Markdown cleanup → ~600-token passages |
| `src/server/ai/vector.ts` | `searchTeachings()` — pgvector cosine + **keyword fallback** |
| `src/server/ingestOne.ts` · `scripts/ingest.ts` | Scrape + embed into `teaching_chunks` |
| `src/app/api/coach+api.ts` | Retrieval-augmented nudge (Claude), "coach not counselor" |
| `db/migrations/0004_corpus.sql` | pgvector + `teaching_chunks` (not under RLS) |

## Graceful degradation

- **No keys** → coach 503s (needs `ANTHROPIC_API_KEY`), but `searchTeachings` works via
  **keyword search** over the curated teachings, so retrieval is testable immediately.
- **`ANTHROPIC_API_KEY` only** → coach generates, grounded in the curated teachings.
- **+ `VOYAGE_API_KEY`** → after `npm run ingest`, full pgvector semantic retrieval.
- **+ `TAVILY_API_KEY`** → `npm run ingest` also scrapes the source URLs for depth.

## Setup

```bash
# 1. env: ANTHROPIC_API_KEY (required), VOYAGE_API_KEY (semantic), TAVILY_API_KEY (scrape)
# 2. vector store (Neon supports pgvector):
npm run db:migrate            # applies 0004_corpus.sql (create extension vector + table)
# 3. embed the corpus:
npm run ingest                # curated teachings + web scrape
npm run ingest -- --curated-only   # just the curated teachings (no Tavily)
```

## Adding an ideology

1. Add its `Ideology` value + labels in `src/data/corpus/types.ts`.
2. Add teachings (and optionally source URLs) to `teachings.json`.
3. Add authoritative domains to `sourceDomainsFor()` in `src/server/ai/tavily.ts`.
4. `npm run ingest`. Done — retrieval and the coach pick it up automatically.
