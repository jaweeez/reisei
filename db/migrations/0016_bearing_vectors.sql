-- Reisei — 0016_bearing_vectors.sql  (embeddings for the Bearing's own selectable pieces)
--
-- To weight the daily Bearing toward what a person is carrying, we score the school's curated
-- quotes and the felt-states (DAILY_STATES) against the user's struggle signal by cosine
-- similarity. This caches an embedding per piece so we embed each one once, then reuse it.
-- Small + static (~40 quotes + 12 states); populated lazily on first use by
-- src/server/bearing/vectors.ts. Shared, non-sensitive, read-only knowledge — NO RLS (mirrors
-- teaching_chunks, 0004): the app role reads it via the db:provision grant; the owner writes it.

begin;

create table bearing_vectors (
  ref        text primary key,                 -- quote citation (e.g. 'Meditations 2.1') or a state string
  kind       text not null,                     -- 'quote' | 'state'
  embedding  vector(1024) not null,
  created_at timestamptz not null default now()
);
create index bearing_vectors_embedding_idx on bearing_vectors using hnsw (embedding vector_cosine_ops);

commit;
