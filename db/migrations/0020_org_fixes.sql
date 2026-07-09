-- Reisei — 0020_org_fixes.sql  (review fixes: org renewal + seat-funded Corner joins)
--
-- Two confirmed defects from the adversarial review of 0019:
--
-- 1. subscriptions_org_uidx was unique over live AND dead rows, so an org that canceled
--    could never hold a NEW subscription row: the renewal webhook would 23505-loop forever
--    (customer charged in Stripe, never recorded here). Readers already pick the latest
--    active row, so uniqueness isn't needed — a plain lookup index is.
--
-- 2. The Corner-seat product was circular: joining required premium, but the captain's
--    purchased seats could only be assigned to existing members — so a FREE invitee (the
--    exact person seats are bought for) could never get in. corner_join_seated mirrors
--    org_join: joining with a Corner code consumes a free seat from the captain's pool,
--    atomically, and that seat IS the premium.

begin;

-- (1) Renewal: allow successive subscription rows per org.
drop index if exists subscriptions_org_uidx;
create index subscriptions_org_id_idx on subscriptions (org_id) where org_id is not null;

-- (2) Seat-funded Corner join. Lock order matches org_join (subscription row, then the
-- crews row) so the two functions can't deadlock each other.
--   empty set      → unknown code                       (API: 404 → client tries org code)
--   note 'no_seat' → no active pool / pool exhausted    (API: 402 upsell)
--   note 'corner_full' → cap hit, nothing persisted     (API: 409)
--   seated=false, note '' → was already a member        (API: 200)
--   seated=true,  note '' → joined, seat consumed       (API: 200)
create function corner_join_seated(p_user uuid, p_code text)
returns table (crew_id uuid, seated boolean, note text)
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_crew    uuid;
  v_captain uuid;
  v_sub     record;
  n         int;
begin
  select ci.crew_id into v_crew from crew_invites ci where ci.code = p_code;
  if v_crew is null then return; end if;

  if exists (select 1 from crew_members cm where cm.crew_id = v_crew and cm.user_id = p_user) then
    return query select v_crew, false, ''::text;
    return;
  end if;

  select c.captain_id into v_captain from crews c where c.id = v_crew;

  select s.id, s.seats into v_sub
    from subscriptions s
   where s.sponsor_id = v_captain and s.plan = 'team' and s.org_id is null
     and s.status in ('active', 'trialing')
   order by s.created_at desc
   limit 1
   for update;
  if v_sub.id is null then
    return query select v_crew, false, 'no_seat'::text;
    return;
  end if;

  if not exists (select 1 from seat_assignments sa where sa.subscription_id = v_sub.id and sa.user_id = p_user) then
    select count(*) into n from seat_assignments sa where sa.subscription_id = v_sub.id;
    if n >= v_sub.seats then
      return query select v_crew, false, 'no_seat'::text;
      return;
    end if;
  end if;

  -- Cap check under the crews lock BEFORE consuming the seat (no orphan seats on a full Corner).
  perform 1 from crews c where c.id = v_crew for update;
  select count(*) into n from crew_members cm where cm.crew_id = v_crew;
  if n >= 8 then
    return query select v_crew, false, 'corner_full'::text;
    return;
  end if;

  insert into seat_assignments (subscription_id, user_id) values (v_sub.id, p_user) on conflict do nothing;
  insert into crew_members (crew_id, user_id, role) values (v_crew, p_user, 'member');
  update crew_invites set accepted_by_user_id = p_user where code = p_code and accepted_by_user_id is null;
  return query select v_crew, true, ''::text;
end
$$;

commit;
