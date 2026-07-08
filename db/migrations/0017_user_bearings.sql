-- Reisei — 0017_user_bearings.sql  (each user's resolved Bearing for the day)
--
-- The shared `bearings` table (0011) stays the NEUTRAL daily cache: one row per (school, day),
-- generated once and reused. This table is the per-user resolution for a day: either a copy of
-- that neutral bearing, or one built around the user's live struggle (personalized = true).
-- It is the single source of truth the app reads (state + bearing screens), so reads are a
-- plain select with no join. Content is stored inline for the same reason. PRIVATE, RLS
-- owner-only (mirrors bearing_logs / practices).
--
-- bearing_logs (the user's written response to a bearing) now points here via user_bearing_id,
-- since a personalized bearing has no row in the shared `bearings` table.

begin;

create table user_bearings (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references users (id) on delete cascade,
  ideology            text not null,
  local_date          date not null,
  principle           text not null,
  prompt              text,
  quote_text          text,
  quote_ref           text,
  source_url          text not null,
  source_title        text not null,
  source_attribution  text not null,
  personalized        boolean not null default false,
  created_at          timestamptz not null default now(),
  unique (user_id, ideology, local_date)
);
create index user_bearings_user_date_idx on user_bearings (user_id, local_date desc);

alter table user_bearings enable row level security;
create policy user_bearings_all on user_bearings for all
  using (user_id = current_app_user())
  with check (user_id = current_app_user());

-- Point a logged response at the user's resolved bearing (the shared bearing_id stays for
-- legacy rows). Nullable + ON DELETE SET NULL so the log survives a bearing being cleared.
alter table bearing_logs add column user_bearing_id uuid references user_bearings (id) on delete set null;

commit;
