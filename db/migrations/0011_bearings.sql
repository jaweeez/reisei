-- Reisei — 0011_bearings.sql  (The Bearing: a daily principle from a chosen school)
--
-- "The Bearing" is a daily operating principle to steer by, grounded in a school the
-- user follows (Stoicism, CBT, Buddhism, …). Reisei generates its OWN terse wording
-- (never third-party copyrighted text) and links out to a public-domain / authoritative
-- source — the same copyright-safe pattern Enso uses for its daily reflections.
--
-- Three tables:
--   • user_schools  — which schools a user follows (many-to-many). RLS, owner-only.
--   • bearings      — the generated principle, ONE row per (school, local_date), SHARED
--                     across users (cheap: ~one generation per school per day). No RLS —
--                     shared read-only knowledge, like teaching_chunks (0004). Written by
--                     the owner role (adminPool) from the generation path / pre-warm cron.
--   • bearing_logs  — the user's own response to a bearing. PRIVATE self-work, never shown
--                     to the crew (RLS, owner-only) — mirrors `practices` (0009).

begin;

-- Schools a user follows. `ideology` matches teaching_chunks.ideology / the corpus keys.
create table user_schools (
  user_id    uuid not null references users (id) on delete cascade,
  ideology   text not null,
  sort       int not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, ideology)
);
create index user_schools_user_idx on user_schools (user_id, sort);

alter table user_schools enable row level security;
create policy user_schools_all on user_schools for all
  using (user_id = current_app_user())
  with check (user_id = current_app_user());

-- The daily generated principle, one per (school, local_date), shared across users.
create table bearings (
  id                  uuid primary key default gen_random_uuid(),
  ideology            text not null,
  local_date          date not null,
  principle           text not null,        -- Reisei's own terse principle
  prompt              text,                  -- an optional one-line question to sit with
  source_url          text not null,        -- the link-out target
  source_title        text not null,        -- e.g. "Meditations — Marcus Aurelius"
  source_attribution  text not null,        -- e.g. "Marcus Aurelius, Meditations (public domain)"
  grounding           jsonb,                 -- retrieved chunks used (provenance/debug)
  model               text,                  -- generator model, or 'fallback'
  created_at          timestamptz not null default now(),
  unique (ideology, local_date)
);
-- No RLS: shared, non-sensitive, read-only knowledge (mirrors teaching_chunks). The app
-- role reads it (granted select); only the owner role writes it (generation / cron).

-- The user's private response to a bearing. Never surfaced to the crew.
create table bearing_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users (id) on delete cascade,
  bearing_id uuid references bearings (id) on delete set null,
  ideology   text not null,
  local_date date not null,
  note       text not null,
  created_at timestamptz not null default now()
);
create index bearing_logs_user_date_idx on bearing_logs (user_id, local_date desc);

alter table bearing_logs enable row level security;
create policy bearing_logs_all on bearing_logs for all
  using (user_id = current_app_user())
  with check (user_id = current_app_user());

commit;
