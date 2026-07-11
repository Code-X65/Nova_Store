-- 061_admin_lifecycle_cols.sql
-- Audit trail for explicit (manual) Super-Admin lock/unlock actions.
-- is_locked / lock_until already exist (used by failed-login auto lockout);
-- these columns distinguish and record manual lifecycle changes.

alter table users
  add column if not exists lock_type     text default 'auto' check (lock_type in ('auto', 'manual')),
  add column if not exists locked_reason text,
  add column if not exists locked_by     uuid references users(id),
  add column if not exists locked_at     timestamptz;
