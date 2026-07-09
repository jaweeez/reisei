-- Reisei — 0019_orgs.sql  (paid Corners 2–8 + Organizations 9+, multi-Corner)
--
-- The Corner becomes the paid product: every member holds a paid seat (own Pro, a Corner
-- seat, or an org seat — the premium gate lives in /api/crew/join where entitlement is
-- computed). A Corner is 2–8 people, hard cap 8 enforced HERE in crew_join under a row
-- lock. Past 8, the path is an Organization: one owner, one seat pool ($3.99/seat, 9+),
-- MULTIPLE Corners under it (a church with several men's groups is the canonical case).
--
-- Tables follow the house posture: app role gets SELECT via RLS scoped to the member's
-- own orgs; all writes go through owner-role API routes (adminPool, like billing) or the
-- SECURITY DEFINER functions below (like crew_create/crew_join in 0003).

begin;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table orgs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner_id   uuid not null references users (id) on delete restrict,
  created_at timestamptz not null default now()
);
-- One org per owner (v1). Relax later by dropping this index.
create unique index orgs_owner_uidx on orgs (owner_id);

create table org_members (
  id        uuid primary key default gen_random_uuid(),
  org_id    uuid not null references orgs (id) on delete cascade,
  user_id   uuid not null references users (id) on delete cascade,
  role      text not null default 'member' check (role in ('member', 'owner')),
  joined_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index org_members_user_id_idx on org_members (user_id);

-- Org-wide invite codes: joining auto-assigns a seat, optionally landing the joiner in a
-- specific Corner (crew_id). Codes are revocable (revoked_at) and reusable while live.
create table org_invites (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs (id) on delete cascade,
  code       text not null unique,
  crew_id    uuid references crews (id) on delete set null,
  created_by uuid not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index org_invites_org_id_idx on org_invites (org_id);

-- A subscription can fund an org (plan 'org'); a crew can belong to an org.
alter table subscriptions add column org_id uuid references orgs (id) on delete set null;
create unique index subscriptions_org_uidx on subscriptions (org_id) where org_id is not null;

alter table crews add column org_id uuid references orgs (id) on delete set null;
create index crews_org_id_idx on crews (org_id);

-- ---------------------------------------------------------------------------
-- RLS: members may read their own org's rows; nobody writes through the app role.
-- (Default privileges grant the app role CRUD; RLS with select-only policies is what
-- actually restricts writes — no insert/update/delete policy means denied.)
-- ---------------------------------------------------------------------------

create or replace function user_org_ids()
returns setof uuid
language sql stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$ select org_id from org_members where user_id = current_app_user() $$;

alter table orgs        enable row level security;
alter table org_members enable row level security;
alter table org_invites enable row level security;

create policy orgs_select        on orgs        for select using (id in (select user_org_ids()));
create policy org_members_select on org_members for select using (org_id in (select user_org_ids()));
create policy org_invites_select on org_invites for select using (org_id in (select user_org_ids()));

-- ---------------------------------------------------------------------------
-- Corner cap: 8, enforced at the single join path under a row lock.
-- Keep in sync with CORNER_MAX in src/lib/data/types.ts.
-- ---------------------------------------------------------------------------

create or replace function crew_join(p_user uuid, p_code text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  cid uuid;
  n   int;
begin
  select crew_id into cid from crew_invites where code = p_code;
  if cid is null then return null; end if;

  -- Idempotent re-join: already a member → no cap check, no error.
  if exists (select 1 from crew_members where crew_id = cid and user_id = p_user) then
    return cid;
  end if;

  -- Serialize concurrent joins on this crew so the cap can't be raced past.
  perform 1 from crews where id = cid for update;
  select count(*) into n from crew_members where crew_id = cid;
  if n >= 8 then
    raise exception 'corner_full' using errcode = 'RS001';
  end if;

  insert into crew_members (crew_id, user_id, role) values (cid, p_user, 'member');
  update crew_invites set accepted_by_user_id = p_user where code = p_code and accepted_by_user_id is null;
  return cid;
end
$$;

-- crew_create grows an optional org tag (owner-created Corners land inside their org).
-- The 2-arg version must be dropped first or the overload is ambiguous at call sites.
drop function if exists crew_create(uuid, text);
create function crew_create(p_captain uuid, p_name text, p_org uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  cid uuid;
begin
  insert into crews (name, captain_id, org_id) values (nullif(p_name, ''), p_captain, p_org) returning id into cid;
  insert into crew_members (crew_id, user_id, role) values (cid, p_captain, 'captain');
  return cid;
end
$$;

-- ---------------------------------------------------------------------------
-- org_join: the whole join-with-org-code flow, atomic.
--   bad/revoked code            → empty set               (API: 404)
--   org sub not active/trialing → ('org_inactive'), nothing persisted   (API: 409)
--   no seat free                → ('no_seat'), nothing persisted        (API: 409)
--   landing Corner full         → seated + org member, crew_id null, note 'corner_full'
-- Seats are assigned under FOR UPDATE on the subscription row so the count can't race.
-- Already-Pro joiners are seated anyway: deterministic, and has_seat dominates tier.
-- ---------------------------------------------------------------------------

create function org_join(p_user uuid, p_code text)
returns table (org_id uuid, crew_id uuid, seated boolean, note text)
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_org  uuid;
  v_crew uuid;
  v_sub  record;
  n      int;
  v_note text := '';
begin
  select oi.org_id, oi.crew_id into v_org, v_crew
    from org_invites oi
   where oi.code = p_code and oi.revoked_at is null;
  if v_org is null then return; end if;

  select s.id, s.seats into v_sub
    from subscriptions s
   where s.org_id = v_org and s.status in ('active', 'trialing')
   order by s.created_at desc
   limit 1
   for update;
  if v_sub.id is null then
    return query select v_org, null::uuid, false, 'org_inactive'::text;
    return;
  end if;

  if not exists (select 1 from seat_assignments sa where sa.subscription_id = v_sub.id and sa.user_id = p_user) then
    select count(*) into n from seat_assignments sa where sa.subscription_id = v_sub.id;
    if n >= v_sub.seats then
      return query select v_org, null::uuid, false, 'no_seat'::text;
      return;
    end if;
    insert into seat_assignments (subscription_id, user_id) values (v_sub.id, p_user);
  end if;

  insert into org_members (org_id, user_id) values (v_org, p_user) on conflict do nothing;

  if v_crew is not null
     and not exists (select 1 from crew_members cm where cm.crew_id = v_crew and cm.user_id = p_user) then
    perform 1 from crews c where c.id = v_crew for update;
    select count(*) into n from crew_members cm where cm.crew_id = v_crew;
    if n < 8 then
      insert into crew_members (crew_id, user_id, role) values (v_crew, p_user, 'member');
    else
      v_crew := null;
      v_note := 'corner_full';
    end if;
  end if;

  return query select v_org, v_crew, true, v_note;
end
$$;

commit;
