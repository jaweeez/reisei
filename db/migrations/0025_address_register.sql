-- Reisei — 0025_address_register.sql
--
-- Voice register: how a person is addressed. Recovery broadens the audience past the app's
-- male-coded default (docs/VOICE.md), so the register becomes a per-user preference, honored by
-- GENERATED copy via a prompt directive. Existing users default to 'default', so nothing changes
-- for them; static shipped strings are not re-forked this release.
--
-- Also adds the persisted one-time not-treatment acknowledgment for recovery (the 2a picker shows
-- a standing notice; this backs the one-tap acknowledged state).

begin;

alter table users add column address_register text not null default 'default'
  check (address_register in ('default', 'neutral'));

alter table accountability_profiles add column recovery_terms_acknowledged_at timestamptz;

commit;
