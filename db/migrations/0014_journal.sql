-- Reisei — 0014_journal.sql  (The log: a private, free-form journal)
--
-- "The log" is the escalation ladder's reflection rung (docs/VOICE.md): put words to
-- it, private. Free-form entries, never shown to the crew. Each entry is later embedded
-- (Voyage, migration 0015) so the day's Bearing can meet what the person is carrying.
-- PRIVATE self-work under RLS, owner-only — mirrors `practices` (0009) / `bearing_logs`
-- (0011). The `embedding` column is nullable: set only when Voyage is configured, so the
-- log works end-to-end before/without the vector store.

begin;

create table journal_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users (id) on delete cascade,
  local_date date not null,
  body       text not null,
  embedding  vector(1024),          -- set by ingestEntry when vectorEnabled(); else null
  created_at timestamptz not null default now()
);
create index journal_entries_user_created_idx on journal_entries (user_id, created_at desc);

alter table journal_entries enable row level security;
create policy journal_entries_all on journal_entries for all
  using (user_id = current_app_user())
  with check (user_id = current_app_user());

commit;
