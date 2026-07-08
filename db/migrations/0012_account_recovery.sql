-- Reisei — 0012_account_recovery.sql  (verified email + PIN recovery)
--
-- Adds a verified email to accounts and the one-time codes behind email verification and
-- the "forgot PIN" reset. `email_required` is the cohort flag: new signups set it true and
-- must verify (a wall); grandfathered rows stay false and only get a soft nag.

begin;

-- Email on users. Nullable so existing rows are valid (many NULLs are fine under a unique
-- index). Store the address normalized (lowercase) at the app layer.
alter table users add column email text unique;
alter table users add column email_verified boolean not null default false;
alter table users add column email_verified_at timestamptz;
alter table users add column email_required boolean not null default false;

-- One-time codes for email verification + PIN reset. Auth-infrastructure, so NOT under RLS
-- (like `sessions`): read/written via the owner role in the auth routes.
create table auth_codes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users (id) on delete cascade,
  purpose     text not null check (purpose in ('verify_email', 'pin_reset')),
  code_hash   text not null,
  email       text not null,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  attempts    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index auth_codes_user_purpose_idx on auth_codes (user_id, purpose, created_at desc);

-- Register now stores a (required, unverified) email. Returns the new id, or null if the
-- username OR email is taken; the caller disambiguates with a follow-up lookup. Replaces
-- the 3-arg version from 0003_auth.sql.
drop function if exists auth_register_user(text, text, text);
create or replace function auth_register_user(p_username text, p_name text, p_pin_hash text, p_email text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  uid uuid;
begin
  insert into users (name, username, pin_hash, email, email_required)
  values (coalesce(nullif(p_name, ''), 'You'), p_username, p_pin_hash, p_email, true)
  returning id into uid;
  insert into streaks (user_id) values (uid) on conflict do nothing;
  return uid;
exception when unique_violation then
  return null;
end
$$;

-- Look up an account by email (for the not-logged-in reset flow).
create or replace function auth_user_by_email(p_email text)
returns table (id uuid, email_verified boolean)
language sql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select id, email_verified from users where email = p_email
$$;

-- Set a new PIN (post-reset; no session). Also clears any lockout.
create or replace function auth_set_pin(p_user uuid, p_pin_hash text)
returns void
language sql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  update users set pin_hash = p_pin_hash, pin_fail_count = 0, pin_locked_until = null where id = p_user
$$;

-- Set or replace a logged-in user's email (resets it to unverified). Returns false if taken.
create or replace function auth_set_email(p_user uuid, p_email text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
begin
  update users set email = p_email, email_verified = false, email_verified_at = null where id = p_user;
  return true;
exception when unique_violation then
  return false;
end
$$;

-- Mark the email verified, only if it still matches the address that was verified.
create or replace function auth_verify_email(p_user uuid, p_email text)
returns void
language sql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  update users set email_verified = true, email_verified_at = now()
   where id = p_user and email = p_email
$$;

commit;
