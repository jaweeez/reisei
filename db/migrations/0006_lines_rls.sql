-- Reisei — 0006_lines_rls.sql  (P6: The Line — RLS)
--
-- lines: you see your own; crewmates see each other's STATEMENT + verdict (the
-- witness). line_events is the owner's private ledger. Mirrors the existing
-- current_app_user() / user_crew_ids() pattern from 0002_rls.sql.

begin;

alter table lines       enable row level security;
alter table line_events enable row level security;

-- lines: readable by self + crewmates (so a crew can witness the line); writable by self.
create policy lines_select on lines for select
  using (
    user_id = current_app_user()
    or user_id in (select user_id from crew_members where crew_id in (select user_crew_ids()))
  );
create policy lines_write on lines for all
  using (user_id = current_app_user())
  with check (user_id = current_app_user());

-- line_events: the owner's private ledger.
create policy line_events_all on line_events for all
  using (user_id = current_app_user())
  with check (user_id = current_app_user());

commit;
