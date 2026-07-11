-- 060_permission_overrides.sql
-- Granular, ABAC-aware, time-bound permission overrides for admin accounts.
-- Replaces the brittle users.extra_permissions array as the override store.
--   effect    : 'allow' adds, 'deny' subtracts
--   scope     : ABAC attributes (e.g. {store_id, resource_type})
--   conditions: runtime constraints (e.g. {days, ip_cidr})
--   expires_at: NULL = permanent; set = temporary (TTL)

create table if not exists permission_overrides (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id) on delete cascade,
  permission_key text not null,
  effect         text not null check (effect in ('allow', 'deny')),
  scope          jsonb not null default '{}'::jsonb,
  conditions     jsonb not null default '{}'::jsonb,
  granted_by     uuid references users(id),
  expires_at     timestamptz,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists ix_perm_ov_user_active  on permission_overrides (user_id, is_active);
create index if not exists ix_perm_ov_expires       on permission_overrides (expires_at) where expires_at is not null;
create index if not exists ix_perm_ov_key           on permission_overrides (permission_key);
create index if not exists ix_perm_ov_scope_gin     on permission_overrides using gin (scope);
