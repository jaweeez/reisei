-- Reisei — 0004_corpus.sql
--
-- The coach knowledge base: Postgres + pgvector. Teachings from mental-health
-- ideologies (Stoicism, CBT, mindfulness, …) are chunked, embedded with Voyage
-- (voyage-context-4, 1024-dim → see src/server/ai/voyage.ts), and retrieved by
-- cosine similarity to ground the coach's terse nudges.
--
-- Shared read-only knowledge — NOT under RLS. The restricted app role reads it via
-- the table grant + default privileges set up by db:provision; ingest writes it as
-- the owner role. Repurposed from Enso's resource_chunks (state → ideology).

begin;

create extension if not exists vector;

create table if not exists teaching_chunks (
  id         uuid primary key default gen_random_uuid(),
  ref_kind   text not null,            -- 'teaching' (curated) | 'web' (scraped)
  ref_id     text,                     -- teaching id or source id
  ideology   text,                     -- 'stoicism' | 'cbt' | 'mindfulness' | …
  theme      text,                     -- 'control' | 'reframing' | 'impermanence' | …
  title      text,
  url        text,
  content    text not null,
  embedding  vector(1024) not null,
  created_at timestamptz not null default now()
);

create index if not exists teaching_chunks_ideology_idx on teaching_chunks (ideology);
create index if not exists teaching_chunks_embedding_idx
  on teaching_chunks using hnsw (embedding vector_cosine_ops);

commit;
