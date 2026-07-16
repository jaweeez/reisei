-- Reisei — 0026_recovery_mode.sql
--
-- Opt-in Recovery mode (docs/RECOVERY_EXPANSION.md), modeled on Enso's recovery tracker. Sober /
-- clean time is kept in CHAPTERS, not a shame streak: "begin again" ends the current chapter and
-- starts a new one, and prior chapters are preserved. Owner-private, never in the Crew graph. The
-- daily action stays the app's held/slipped Line check-in; this only adds the sober-time layer.
--
-- Independent of following a Recovery school. Enabling this records the not-treatment
-- acknowledgment (0025) if it is not already set.

begin;

create table recovery_profiles (
  user_id      uuid primary key references users (id) on delete cascade,
  -- 'chapter' counts days from started_on; 'practice' is an ongoing practice with no count.
  mode         text not null check (mode in ('chapter', 'practice')),
  started_on   date,
  show_count   boolean not null default true,
  -- Optional, private, free text: what the person is recovering from. Short by construction.
  what_from    text check (what_from is null or char_length(what_from) <= 120),
  has_sponsor  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check ((mode = 'chapter' and started_on is not null) or (mode = 'practice' and started_on is null))
);

create table recovery_chapters (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users (id) on delete cascade,
  started_on  date not null,
  ended_on    date,
  created_at  timestamptz not null default now(),
  check (ended_on is null or ended_on >= started_on)
);
create unique index recovery_chapters_one_active on recovery_chapters (user_id) where ended_on is null;
create index recovery_chapters_user_date on recovery_chapters (user_id, started_on desc);

alter table recovery_profiles enable row level security;
alter table recovery_profiles force row level security;
alter table recovery_chapters enable row level security;
alter table recovery_chapters force row level security;

create policy recovery_profiles_all on recovery_profiles for all
  using (user_id = current_app_user())
  with check (user_id = current_app_user());

create policy recovery_chapters_all on recovery_chapters for all
  using (user_id = current_app_user())
  with check (user_id = current_app_user());

commit;
