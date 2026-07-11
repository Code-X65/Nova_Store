-- 062_admin_purges.sql
-- Immutable forensic archive created when an administrator is permanently removed.
-- The users row is hard-deleted; this table preserves who/when/what for audit
-- and prevents the same email from being silently re-invited without review.

create table if not exists admin_purges (
  id             uuid primary key default gen_random_uuid(),
  purged_user_id uuid not null,
  email          text not null,
  full_name      text,
  roles          jsonb not null default '[]'::jsonb,
  snapshot       jsonb not null default '{}'::jsonb,
  purged_by      uuid references users(id),
  reason         text,
  created_at     timestamptz not null default now()
);

create index if not exists ix_admin_purges_email on admin_purges (email);
