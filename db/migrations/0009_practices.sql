-- Reisei — 0009_practices.sql  (Reset + the kaizen practice ledger)
--
-- Composure practices, logged privately. "Reset" is a ~60s box-breathing + grounding
-- protocol — mindfulness in a discipline costume, surfaced by the coach on hard days.
-- The kind enum leaves room for the escalation ladder (debrief, premeditation). These
-- are PRIVATE self-work — never exposed to the crew.

begin;

create table practices (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users (id) on delete cascade,
  kind       text not null check (kind in ('reset', 'debrief', 'premeditation')),
  local_date date not null,
  note       text,
  created_at timestamptz not null default now()
);
create index practices_user_date_idx on practices (user_id, local_date);

alter table practices enable row level security;
create policy practices_all on practices for all
  using (user_id = current_app_user())
  with check (user_id = current_app_user());

commit;
