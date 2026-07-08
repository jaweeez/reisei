-- Reisei — 0018_email_optional.sql  (email is optional at signup; do not gate onboarding)
--
-- Deliverability for verification emails is being sorted out separately, so we stop gating
-- sign-ups on a verified email. Registration no longer requires an email, and new accounts
-- are created with email_required = FALSE (a soft nag to add one for recovery, never a wall).
-- An empty email is stored as NULL (the users.email unique index treats NULLs as distinct, so
-- many address-less accounts are fine; '' would collide).
--
-- To RE-GATE later (once email delivers reliably): restore email_required = true here (and the
-- required-email validation in register+api.ts + the verify-email redirect in (tabs)/_layout).

begin;

create or replace function auth_register_user(p_username text, p_name text, p_pin_hash text, p_email text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  uid uuid;
begin
  insert into users (name, username, pin_hash, email, email_required)
  values (coalesce(nullif(p_name, ''), 'You'), p_username, p_pin_hash, nullif(p_email, ''), false)
  returning id into uid;
  insert into streaks (user_id) values (uid) on conflict do nothing;
  return uid;
exception when unique_violation then
  return null;
end
$$;

commit;
