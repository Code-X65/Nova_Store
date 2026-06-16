-- 034_admin_lockout_and_audit.sql
-- Add status/lockout columns to admins table and user_agent to admin_auth_logs

-- 1. Add lockout and status columns to public.admins
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS failed_login_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS lock_until TIMESTAMPTZ DEFAULT NULL;

-- 2. Add user_agent column to public.admin_auth_logs
ALTER TABLE public.admin_auth_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
