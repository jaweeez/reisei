-- Reisei — 0015_profile.sql  (the ambient profile built from the log)
--
-- A quiet, per-user profile derived from the log (0014). `centroid` is a running EMA of the
-- user's entry embeddings (Voyage, 1024-dim — see src/server/ai/voyage.ts): the stable
-- backdrop of what this person keeps circling. The responsive "what's live right now" signal
-- is computed on demand from recent entries (src/server/profile/profile.ts), not stored here.
-- PRIVATE, owner-only under RLS (mirrors bearing_logs / practices). Derived data, never shown
-- to the crew and never surfaced as a screen — it only tunes the Bearing.
--
-- Cosine distance (pgvector <=>) is scale-invariant, so the EMA needs no normalization.

begin;

create table user_profiles (
  user_id       uuid primary key references users (id) on delete cascade,
  centroid      vector(1024),                     -- long-run EMA of entry embeddings; null until first
  entries_count int not null default 0,           -- non-dark entries folded into the centroid
  last_entry_at timestamptz,                        -- freshness anchor for the "live struggle" fade
  updated_at    timestamptz not null default now()
);

alter table user_profiles enable row level security;
create policy user_profiles_all on user_profiles for all
  using (user_id = current_app_user())
  with check (user_id = current_app_user());

commit;
