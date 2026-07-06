-- Reisei — 0007_acks.sql  (P7: The Witness)
--
-- Structured, disciplined crew acknowledgments — no free text, no emoji. One per
-- pair per day per kind (unique index = the rate limit). Posture-mapped in the UI:
--   held  → SEEN      (I witnessed your held day)
--   broke → RESPECT   (for logging an honest break — makes honesty pay)
--   dark  → STAND UP  (nudge a crewmate who's gone dark; fires a push in P8)

begin;

create table crew_acks (
  id           uuid primary key default gen_random_uuid(),
  crew_id      uuid not null references crews (id) on delete cascade,
  from_user_id uuid not null references users (id) on delete cascade,
  to_user_id   uuid not null references users (id) on delete cascade,
  local_date   date not null,
  kind         text not null check (kind in ('seen', 'respect', 'stand_up')),
  created_at   timestamptz not null default now(),
  unique (crew_id, from_user_id, to_user_id, local_date, kind)
);
create index crew_acks_crew_date_idx on crew_acks (crew_id, local_date);
create index crew_acks_to_user_idx on crew_acks (to_user_id, local_date);

alter table crew_acks enable row level security;

-- Readable by co-members of the crew (the witness is mutual).
create policy crew_acks_select on crew_acks for select
  using (crew_id in (select user_crew_ids()));
-- Insert only as yourself, into a crew you belong to.
create policy crew_acks_insert on crew_acks for insert
  with check (from_user_id = current_app_user() and crew_id in (select user_crew_ids()));

commit;
