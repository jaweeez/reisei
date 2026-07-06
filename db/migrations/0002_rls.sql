-- Reisei — 0002_rls.sql
--
-- Row-Level Security. Request-time queries run as the restricted app role
-- (APP_DATABASE_URL, NOBYPASSRLS) with the acting user set via
-- set_config('app.current_user_id', <uuid>, true) inside withUser() (see src/server/db.ts).
--
-- Crew visibility is resolved through a SECURITY DEFINER helper (user_crew_ids)
-- so policies don't recurse on crew_members. Billing tables (subscriptions,
-- seat_assignments) are intentionally NOT under RLS — only the owner role /
-- webhooks touch them.

begin;

-- The acting user id for this transaction, or null if unset. `true` = missing_ok.
create or replace function current_app_user()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.current_user_id', true), '')::uuid
$$;

-- The crew ids the acting user belongs to. SECURITY DEFINER + row_security off so
-- it reads crew_members fully (breaking the policy recursion).
create or replace function user_crew_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select crew_id from crew_members where user_id = current_app_user()
$$;

alter table users        enable row level security;
alter table crews        enable row level security;
alter table crew_members enable row level security;
alter table crew_invites enable row level security;
alter table check_ins    enable row level security;
alter table streaks      enable row level security;
alter table device_tokens enable row level security;

-- users: see yourself + your crewmates; update only yourself.
create policy users_select on users for select
  using (id = current_app_user() or id in (select user_id from crew_members where crew_id in (select user_crew_ids())));
create policy users_update on users for update
  using (id = current_app_user()) with check (id = current_app_user());

-- crews: visible to members. Writes go through SECURITY DEFINER funcs (0003).
create policy crews_select on crews for select
  using (id in (select user_crew_ids()));

-- crew_members: visible to co-members.
create policy crew_members_select on crew_members for select
  using (crew_id in (select user_crew_ids()));

-- crew_invites: visible to crew members (the captain shares the code).
create policy crew_invites_select on crew_invites for select
  using (crew_id in (select user_crew_ids()));

-- check_ins: your own + anyone who shares a crew with you (that's how crew presence
-- is derived — independent of which crew a check-in was attributed to).
create policy check_ins_select on check_ins for select
  using (
    user_id = current_app_user()
    or user_id in (select user_id from crew_members where crew_id in (select user_crew_ids()))
  );
create policy check_ins_insert on check_ins for insert
  with check (user_id = current_app_user());

-- streaks: yours only.
create policy streaks_all on streaks for all
  using (user_id = current_app_user()) with check (user_id = current_app_user());

-- device_tokens: yours only.
create policy device_tokens_all on device_tokens for all
  using (user_id = current_app_user()) with check (user_id = current_app_user());

commit;
