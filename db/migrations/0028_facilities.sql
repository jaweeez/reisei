-- Reisei — 0028_facilities.sql  (facility-sponsored seats, Phase 1)
--
-- A treatment facility funds a pool of Pro seats and hands out codes. A client redeems a code and
-- gets full private Pro, STANDALONE and ANONYMOUS: the facility never learns who claimed a seat and
-- sees only counts. See docs/FACILITY_SPONSORSHIP.md.
--
-- Seats reuse the existing plumbing: the facility's subscription (subscriptions.facility_id) funds
-- N seats, and a claim is a seat_assignment against it. entitlement.ts already grants `team` tier for
-- an active seat_assignment, so NO entitlement change is needed and a facility client is never placed
-- in a crew. Distinct facility tables keep the concept separate from orgs.

begin;

create table facilities (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  admin_user_id uuid not null references users (id) on delete restrict,
  billing_mode  text not null default 'self_serve' check (billing_mode in ('self_serve', 'invoice')),
  baa_signed_at timestamptz,
  created_at    timestamptz not null default now()
);
-- One facility per admin (v1). Relax later by dropping this index.
create unique index facilities_admin_uidx on facilities (admin_user_id);

-- Seats are funded via a subscription tagged with the facility (mirrors org_id in 0019).
alter table subscriptions add column facility_id uuid references facilities (id) on delete set null;
create unique index subscriptions_facility_uidx on subscriptions (facility_id) where facility_id is not null;

-- Anonymous, revocable, reusable claim codes scoped to a facility (mirrors org_invites).
create table facility_invites (
  id          uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities (id) on delete cascade,
  code        text not null unique,
  created_by  uuid not null references users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz
);
create index facility_invites_facility_idx on facility_invites (facility_id);

-- ---------------------------------------------------------------------------
-- RLS: a facility admin reads their own facility + invites; writes go through the owner-role API or
-- the SECURITY DEFINER claim function below (mirrors orgs — no write policy means denied).
-- ---------------------------------------------------------------------------
create or replace function user_facility_ids()
returns setof uuid
language sql stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$ select id from facilities where admin_user_id = current_app_user() $$;

alter table facilities       enable row level security;
alter table facility_invites enable row level security;

create policy facilities_select       on facilities       for select using (admin_user_id = current_app_user());
create policy facility_invites_select on facility_invites for select using (facility_id in (select user_facility_ids()));

-- A client claims a seat by code, anonymously. The facility's funding subscription row is locked so
-- concurrent claims cannot exceed the purchased seat count. Returns a note the API maps to a message.
create function facility_claim(p_user uuid, p_code text)
returns table (claimed boolean, note text)
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_fac uuid;
  v_sub uuid;
  v_seats int;
  n int;
begin
  select fi.facility_id into v_fac
    from facility_invites fi
   where fi.code = p_code and fi.revoked_at is null;
  if v_fac is null then
    return query select false, 'invalid_code'::text;
    return;
  end if;

  -- The facility's active seat-funding subscription (locked to serialize concurrent claims).
  select s.id, s.seats into v_sub, v_seats
    from subscriptions s
   where s.facility_id = v_fac and s.status in ('active', 'trialing')
   order by s.created_at desc
   limit 1
   for update;
  if v_sub is null then
    return query select false, 'inactive'::text;
    return;
  end if;

  -- Idempotent: an existing claim is a success (re-entering the code does nothing).
  if exists (select 1 from seat_assignments sa where sa.subscription_id = v_sub and sa.user_id = p_user) then
    return query select true, ''::text;
    return;
  end if;

  select count(*) into n from seat_assignments sa where sa.subscription_id = v_sub;
  if n >= v_seats then
    return query select false, 'seat_full'::text;
    return;
  end if;

  insert into seat_assignments (subscription_id, user_id)
  values (v_sub, p_user)
  on conflict (subscription_id, user_id) do nothing;
  return query select true, ''::text;
end
$$;

commit;
