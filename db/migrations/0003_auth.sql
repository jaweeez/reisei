-- Reisei — 0003_auth.sql
--
-- Server-side sessions + the SECURITY DEFINER functions that must act before/around
-- an app.current_user_id exists (registration) or that write crew tables the app role
-- has no INSERT policy for (crew create/join/invite). Each takes the actor explicitly
-- so it can be called on the plain pool, not only inside withUser().

begin;

-- sessions — opaque, server-side, revocable. Not under RLS (auth-infrastructure).
create table sessions (
  token        text primary key,               -- 64-hex random
  user_id      uuid not null references users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  last_seen_at timestamptz not null default now(),
  user_agent   text
);
create index sessions_user_id_idx on sessions (user_id);
create index sessions_expires_at_idx on sessions (expires_at);

-- Register a user. Returns the new id, or null if the username is taken. Seeds a
-- zeroed streaks row so the home screen always has one to read.
create or replace function auth_register_user(p_username text, p_name text, p_pin_hash text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  uid uuid;
begin
  insert into users (name, username, pin_hash)
  values (coalesce(nullif(p_name, ''), 'You'), p_username, p_pin_hash)
  returning id into uid;
  insert into streaks (user_id) values (uid) on conflict do nothing;
  return uid;
exception when unique_violation then
  return null;
end
$$;

create or replace function auth_user_by_username(p_username text)
returns table (id uuid, pin_hash text, pin_locked_until timestamptz)
language sql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select id, pin_hash, pin_locked_until from users where username = p_username
$$;

create or replace function auth_note_pin_failure(p_user uuid, p_max int, p_lock_minutes int)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
begin
  update users
     set pin_fail_count = pin_fail_count + 1,
         pin_locked_until = case when pin_fail_count + 1 >= p_max
                                 then now() + (p_lock_minutes || ' minutes')::interval
                                 else pin_locked_until end
   where id = p_user;
end
$$;

create or replace function auth_clear_pin_failures(p_user uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  update users set pin_fail_count = 0, pin_locked_until = null where id = p_user
$$;

-- ---------------------------------------------------------------------------
-- Crew writes (actor passed explicitly). Entitlement (Pro/Team) is checked in the
-- API route BEFORE calling crew_create.
-- ---------------------------------------------------------------------------
create or replace function crew_create(p_captain uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  cid uuid;
begin
  insert into crews (name, captain_id) values (nullif(p_name, ''), p_captain) returning id into cid;
  insert into crew_members (crew_id, user_id, role) values (cid, p_captain, 'captain');
  return cid;
end
$$;

-- Join the crew behind an invite code. Returns the crew id, or null if the code is bad.
create or replace function crew_join(p_user uuid, p_code text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  cid uuid;
begin
  select crew_id into cid from crew_invites where code = p_code;
  if cid is null then return null; end if;
  insert into crew_members (crew_id, user_id, role) values (cid, p_user, 'member')
    on conflict (crew_id, user_id) do nothing;
  update crew_invites set accepted_by_user_id = p_user where code = p_code and accepted_by_user_id is null;
  return cid;
end
$$;

-- Create an invite code for a crew the actor captains. Returns false if not the captain.
create or replace function crew_create_invite(p_user uuid, p_crew uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
begin
  if not exists (select 1 from crew_members where crew_id = p_crew and user_id = p_user and role = 'captain') then
    return false;
  end if;
  insert into crew_invites (crew_id, code, created_by) values (p_crew, p_code, p_user);
  return true;
end
$$;

commit;
