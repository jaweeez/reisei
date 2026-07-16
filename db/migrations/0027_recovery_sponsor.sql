-- Reisei — 0027_recovery_sponsor.sql
--
-- A private, off-Crew sponsor contact (docs/RECOVERY_EXPANSION.md, Phase 5). Not tied to a Crew and
-- never shared: just a name + how to reach them, stored on the owner's recovery profile and surfaced
-- to them when they need it (a break, the recovery-mode screen). `has_sponsor` (0026) stays the
-- yes/no signal; these hold the details.

begin;

alter table recovery_profiles
  add column sponsor_name    text check (sponsor_name is null or char_length(sponsor_name) <= 80),
  add column sponsor_contact text check (sponsor_contact is null or char_length(sponsor_contact) <= 120);

commit;
