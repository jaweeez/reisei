-- Reisei — 0005_lines.sql  (P6: The Line)
--
-- Gives the contentless check-in real content: a LINE — one named standard the user
-- holds under pressure — and a daily VERDICT (held / broke / dark). "Dark" (missed)
-- is never a row; it's the absence of a check_in for a local_date, derived.
--
-- Honesty must be mechanically cheaper than silence: an honest BROKE resets the hold
-- streak but preserves a separate INTEGRITY counter that only a silent MISS damages.
-- All additive; check_ins/streaks uniqueness unchanged.

begin;

-- THE CORE OBJECT. A single standard the user holds. Statement is shown VERBATIM.
create table lines (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references users (id) on delete cascade,
  statement          text not null check (length(statement) between 2 and 80),
  kind               text not null default 'abstain' check (kind in ('abstain', 'hold')),  -- "don't X" | "do X / stay above the bar"
  status             text not null default 'active' check (status in ('active', 'retired')),
  crew_id            uuid references crews (id) on delete set null,
  start_local_date   date not null,
  retired_local_date date,
  created_at         timestamptz not null default now()
);
-- Enforce "one active line per user" at the DB (P6). Pro multi-line is a later phase.
create unique index lines_one_active_per_user on lines (user_id) where status = 'active';

-- EXTEND check_ins: bind the log to a line + give it a verdict. note is the ≤140-char
-- "field report" (tightened in the API). Uniqueness stays (user_id, local_date).
alter table check_ins add column line_id uuid references lines (id) on delete set null;
alter table check_ins add column verdict text not null default 'held' check (verdict in ('held', 'broke'));

-- EXTEND streaks: track honesty (integrity) distinctly from the hold streak.
alter table streaks add column last_verdict text check (last_verdict in ('held', 'broke'));
alter table streaks add column breaks    integer not null default 0;  -- honest breaks logged
alter table streaks add column resets    integer not null default 0;  -- times the hold streak was lost
alter table streaks add column integrity integer not null default 0;  -- consecutive days LOGGED (held OR broke); only a MISS resets it

-- Append-only ledger of every verdict (the Pro "Ledger" reads this in P9).
create table line_events (
  id         uuid primary key default gen_random_uuid(),
  line_id    uuid not null references lines (id) on delete cascade,
  user_id    uuid not null references users (id) on delete cascade,
  local_date date not null,
  verdict    text not null check (verdict in ('held', 'broke')),
  note       text,
  created_at timestamptz not null default now(),
  unique (line_id, local_date)
);
create index line_events_user_date_idx on line_events (user_id, local_date);

commit;
