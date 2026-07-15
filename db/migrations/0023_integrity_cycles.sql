-- Reisei 1.5: integrity agreement, 14-day Line Cycles, and Pro coverage.

begin;

create table accountability_profiles (
  user_id                    uuid primary key references users (id) on delete cascade,
  honesty_acknowledged_at    timestamptz,
  reach_out_preference       text check (reach_out_preference in ('reisei_nudge', 'text', 'call', 'next_meeting', 'one_day')),
  updated_at                 timestamptz not null default now()
);

create table line_cycles (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users (id) on delete cascade,
  line_id          uuid not null references lines (id) on delete cascade,
  start_local_date date not null,
  review_local_date date not null,
  end_local_date   date,
  outcome          text not null default 'active'
                   check (outcome in ('active', 'kept', 'refined', 'raised', 'replaced', 'retired', 'changed_early')),
  created_at       timestamptz not null default now(),
  check (review_local_date > start_local_date),
  check ((outcome = 'active' and end_local_date is null) or (outcome <> 'active' and end_local_date is not null))
);
create unique index line_cycles_one_active_per_user on line_cycles (user_id) where outcome = 'active';
create index line_cycles_user_start_idx on line_cycles (user_id, start_local_date desc);
create index line_cycles_line_idx on line_cycles (line_id);

create table line_reviews (
  id                uuid primary key default gen_random_uuid(),
  cycle_id          uuid not null unique references line_cycles (id) on delete cascade,
  user_id           uuid not null references users (id) on delete cascade,
  action            text not null check (action in ('keep', 'refine', 'raise', 'replace', 'retire')),
  easier             text,
  friction           text,
  next_standard      text,
  early_reason       text check (early_reason in ('unclear', 'unrealistic', 'circumstances', 'unsafe', 'other')),
  created_at         timestamptz not null default now()
);
create index line_reviews_user_idx on line_reviews (user_id, created_at desc);

-- A direct Pro subscription covers two other accounts. Rows remain through a
-- temporary lapse so renewal restores coverage; entitlement checks the sponsor's
-- current users.plan before granting access.
create table pro_covered_members (
  id          uuid primary key default gen_random_uuid(),
  sponsor_id  uuid not null references users (id) on delete cascade,
  user_id     uuid not null references users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (sponsor_id, user_id),
  unique (user_id),
  check (sponsor_id <> user_id)
);
create index pro_covered_members_sponsor_idx on pro_covered_members (sponsor_id);

-- Existing active Lines begin a fresh 1.5 Cycle on migration day. This avoids
-- surprising long-time users with an immediately overdue review.
insert into line_cycles (user_id, line_id, start_local_date, review_local_date)
select user_id, id, current_date, current_date + 14
  from lines
 where status = 'active'
on conflict do nothing;

alter table accountability_profiles enable row level security;
alter table line_cycles enable row level security;
alter table line_reviews enable row level security;

create policy accountability_profiles_select on accountability_profiles for select
  using (
    user_id = current_app_user()
    or user_id in (select user_id from crew_members where crew_id in (select user_crew_ids()))
  );
create policy accountability_profiles_write on accountability_profiles for all
  using (user_id = current_app_user())
  with check (user_id = current_app_user());

create policy line_cycles_all on line_cycles for all
  using (user_id = current_app_user())
  with check (user_id = current_app_user());

create policy line_reviews_all on line_reviews for all
  using (user_id = current_app_user())
  with check (user_id = current_app_user());

-- A free invitee may consume one of a direct Pro captain's two covered spots.
-- The sponsor row and Crew row are locked so concurrent joins cannot exceed a
-- coverage limit or the eight-person Crew cap.
create function crew_join_pro_covered(p_user uuid, p_code text)
returns table (crew_id uuid, covered boolean, note text)
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_crew uuid;
  v_captain uuid;
  n int;
begin
  select ci.crew_id, c.captain_id into v_crew, v_captain
    from crew_invites ci join crews c on c.id = ci.crew_id
   where ci.code = p_code;
  if v_crew is null then return; end if;

  if exists (select 1 from crew_members cm where cm.crew_id = v_crew and cm.user_id = p_user) then
    return query select v_crew, false, ''::text;
    return;
  end if;

  perform 1 from users u where u.id = v_captain for update;
  if not exists (select 1 from users u where u.id = v_captain and u.plan = 'pro') then
    return query select v_crew, false, 'no_cover'::text;
    return;
  end if;

  -- Release stale coverage from a lapsed sponsor before claiming a new spot.
  delete from pro_covered_members pcm
   where pcm.user_id = p_user
     and not exists (select 1 from users old_sponsor where old_sponsor.id = pcm.sponsor_id and old_sponsor.plan = 'pro');

  if not exists (select 1 from pro_covered_members pcm where pcm.sponsor_id = v_captain and pcm.user_id = p_user) then
    select count(*) into n from pro_covered_members pcm where pcm.sponsor_id = v_captain;
    if n >= 2 then
      return query select v_crew, false, 'no_cover'::text;
      return;
    end if;
  end if;

  perform 1 from crews c where c.id = v_crew for update;
  select count(*) into n from crew_members cm where cm.crew_id = v_crew;
  if n >= 8 then
    return query select v_crew, false, 'crew_full'::text;
    return;
  end if;

  insert into pro_covered_members (sponsor_id, user_id)
  values (v_captain, p_user)
  on conflict (sponsor_id, user_id) do nothing;
  insert into crew_members (crew_id, user_id, role) values (v_crew, p_user, 'member');
  update crew_invites set accepted_by_user_id = p_user where code = p_code and accepted_by_user_id is null;
  return query select v_crew, true, ''::text;
end
$$;

commit;
