-- Reisei — 0008_nudges.sql  (P8: The Coach)
--
-- The coach is a scheduled, rule-driven nudge engine — never a chatbot. nudges is the
-- dedupe/outbox ledger: a kind fires at most once per user per local day. Copy is
-- server-computed so it's always factually true. hold_time is the one user-tunable
-- knob (timing); the content is never user-tunable — the discipline is the point.

begin;

-- The local HH:MM the "post" nudge fires (a still-open line reminder).
alter table users add column hold_time text not null default '20:00';

create table nudges (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users (id) on delete cascade,
  crew_id    uuid references crews (id) on delete set null,
  kind       text not null,   -- post | at_risk | after_break | after_miss | stand_up | milestone
  local_date date not null,
  body       text,
  channel    text not null default 'push' check (channel in ('push', 'inapp')),
  sent_at    timestamptz not null default now(),
  unique (user_id, kind, local_date)
);
create index nudges_user_date_idx on nudges (user_id, local_date);

-- Owner-written (by the cron via adminPool); the app reads its own for an in-app banner.
alter table nudges enable row level security;
create policy nudges_select on nudges for select using (user_id = current_app_user());

commit;
