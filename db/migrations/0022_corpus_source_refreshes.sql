-- Reisei — 0022_corpus_source_refreshes.sql
--
-- Tracks refreshes of the approved source cache that grounds daily Bearings. Source pages are
-- fetched and embedded server-side, never from a reader's request. One due source is refreshed
-- per cron invocation; each source is due again after 89 days.

begin;

create table corpus_source_refreshes (
  source_id       text primary key,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  chunk_count     integer not null default 0,
  last_error      text
);

create index corpus_source_refreshes_due_idx on corpus_source_refreshes (last_success_at);

commit;
