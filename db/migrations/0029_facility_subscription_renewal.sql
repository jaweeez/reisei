-- Reisei — 0029_facility_subscription_renewal.sql
--
-- A facility can have only one live subscription at a time, but it must be able to start a new
-- Stripe subscription after an older one is canceled. The unique index from 0028 covered dead
-- rows too, so a replacement webhook would fail with a uniqueness violation. Readers already pick
-- the latest active/trialing row, matching the organization renewal fix in 0020.

begin;

drop index if exists subscriptions_facility_uidx;
create index subscriptions_facility_id_idx on subscriptions (facility_id) where facility_id is not null;

commit;
