-- Reisei — 0001_init.sql
--
-- The schema for a discipline/accountability app: daily check-ins, streaks, and a
-- crew (small accountability group with presence). Money/entitlement follow the
-- two-rail model (Stripe web + RevenueCat IAP → one effective tier).
--
-- Timestamps are timestamptz. Ids are uuids. A "day" is the user's LOCAL calendar
-- day (see users.tz + the unique (user_id, local_date) index on check_ins).
--
-- Apply with:  psql "$DATABASE_URL" -f db/migrations/0001_init.sql   (or npm run db:migrate)

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Users + auth (username + PIN, bcrypt-hashed). Passkeys are the upgrade path.
-- ---------------------------------------------------------------------------
create table users (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  username         text not null unique,
  pin_hash         text not null,
  -- IANA timezone; streaks are computed against the user's LOCAL day.
  tz               text not null default 'UTC',
  -- Individual plan rail: 'free' | 'pro'. Team seats are computed separately.
  plan             text not null default 'free' check (plan in ('free', 'pro')),
  stripe_customer_id text,
  -- PIN brute-force protection.
  pin_fail_count   integer not null default 0,
  pin_locked_until timestamptz,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Crews — a small accountability group. One captain, many members.
-- ---------------------------------------------------------------------------
create table crews (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  captain_id uuid not null references users (id) on delete restrict,
  created_at timestamptz not null default now()
);
create index crews_captain_id_idx on crews (captain_id);

create table crew_members (
  id        uuid primary key default gen_random_uuid(),
  crew_id   uuid not null references crews (id) on delete cascade,
  user_id   uuid not null references users (id) on delete cascade,
  role      text not null default 'member' check (role in ('member', 'captain')),
  joined_at timestamptz not null default now(),
  unique (crew_id, user_id)
);
create index crew_members_crew_id_idx on crew_members (crew_id);
create index crew_members_user_id_idx on crew_members (user_id);

create table crew_invites (
  id                  uuid primary key default gen_random_uuid(),
  crew_id             uuid not null references crews (id) on delete cascade,
  code                text not null unique,
  created_by          uuid not null references users (id) on delete cascade,
  created_at          timestamptz not null default now(),
  accepted_by_user_id uuid references users (id) on delete set null
);
create index crew_invites_crew_id_idx on crew_invites (crew_id);

-- ---------------------------------------------------------------------------
-- Check-ins + streaks — the core loop. One check-in per user per LOCAL day.
-- ---------------------------------------------------------------------------
create table check_ins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users (id) on delete cascade,
  -- Optional: attribute the check-in to a crew (for that crew's presence row).
  crew_id    uuid references crews (id) on delete set null,
  note       text,
  logged_at  timestamptz not null default now(),
  -- The user's LOCAL calendar date, frozen at insert (server-derived from users.tz).
  local_date date not null,
  -- Enforces "one check-in per local day".
  unique (user_id, local_date)
);
create index check_ins_user_id_idx on check_ins (user_id);
create index check_ins_crew_local_idx on check_ins (crew_id, local_date);

create table streaks (
  user_id         uuid primary key references users (id) on delete cascade,
  current         integer not null default 0,
  longest         integer not null default 0,
  last_local_date date
);

-- ---------------------------------------------------------------------------
-- Billing — Team (leader-paid) subscriptions + seat assignments. The individual
-- Pro rail lives on users.plan; these tables carry the sponsored-seat rail.
-- Written ONLY by webhooks/admin (owner role), so they stay out of RLS.
-- ---------------------------------------------------------------------------
create table subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  sponsor_id             uuid not null references users (id) on delete cascade,
  provider               text not null default 'stripe',
  plan                   text not null default 'team',
  status                 text not null default 'active',
  seats                  integer not null default 0,
  stripe_subscription_id text unique,
  stripe_customer_id     text,
  current_period_end     timestamptz,
  created_at             timestamptz not null default now()
);
create index subscriptions_sponsor_id_idx on subscriptions (sponsor_id);

create table seat_assignments (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions (id) on delete cascade,
  user_id         uuid not null references users (id) on delete cascade,
  assigned_at     timestamptz not null default now(),
  unique (subscription_id, user_id)
);
create index seat_assignments_user_id_idx on seat_assignments (user_id);

-- ---------------------------------------------------------------------------
-- Push tokens (Expo). One row per device.
-- ---------------------------------------------------------------------------
create table device_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users (id) on delete cascade,
  token      text not null unique,
  platform   text,
  updated_at timestamptz not null default now()
);
create index device_tokens_user_id_idx on device_tokens (user_id);

commit;
