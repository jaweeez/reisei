-- Reisei — 0024_user_bearing_vectors.sql
--
-- Embedding of each shown Bearing read, per user. This is what enforces the no-repeat rule
-- (docs/RECOVERY_EXPANSION.md, hard requirement): when a read is generated, it is rejected and
-- re-rolled if it is too similar to the reader's recent reads across ALL their schools. Nullable:
-- older rows and rows resolved without Voyage stay null and are simply skipped by the check.

begin;

alter table user_bearings add column principle_vec vector(1024);

commit;
