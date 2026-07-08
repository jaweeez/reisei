-- 0010_admin.sql — a true platform admin (superuser) flag.
--
-- There is no "admin tier" — admin is orthogonal to plan/entitlement. Admin-only API
-- routes run as the OWNER role (adminPool, BYPASSRLS) behind an is_admin guard, so an
-- admin can read/moderate across every user and crew without weakening request-time RLS
-- for normal users. This column is that guard.
alter table users add column if not exists is_admin boolean not null default false;

-- Fast "list all admins" for the dashboard overview.
create index if not exists users_is_admin_idx on users (is_admin) where is_admin;
