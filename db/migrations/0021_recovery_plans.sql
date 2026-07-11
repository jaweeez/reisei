-- Reisei — 0021_recovery_plans.sql  (the turn after an honest break)
--
-- A break is useful only when it changes the next attempt. This private record captures
-- the friction and one concrete move, then carries that move into the next local day.

begin;

create table recovery_plans (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users (id) on delete cascade,
  line_id           uuid not null references lines (id) on delete cascade,
  source_local_date date not null,
  friction          text not null check (friction in ('time', 'energy', 'conflict', 'avoidance')),
  move              text not null check (length(move) between 2 and 140),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, source_local_date)
);
create index recovery_plans_user_date_idx on recovery_plans (user_id, source_local_date desc);

alter table recovery_plans enable row level security;
create policy recovery_plans_all on recovery_plans for all
  using (user_id = current_app_user())
  with check (user_id = current_app_user());

commit;
