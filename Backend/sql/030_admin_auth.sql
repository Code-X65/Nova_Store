-- ============================================================
-- Migration: 030_admin_auth.sql
-- Standalone admin authentication tables
-- ============================================================

-- 1. Dedicated admins table (separate from public.users)
CREATE TABLE IF NOT EXISTS public.admins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep updated_at current automatically
CREATE OR REPLACE FUNCTION public.set_admins_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admins_updated_at ON public.admins;
CREATE TRIGGER trg_admins_updated_at
  BEFORE UPDATE ON public.admins
  FOR EACH ROW EXECUTE FUNCTION public.set_admins_updated_at();

-- 2. Admin auth log (success & failure events)
CREATE TABLE IF NOT EXISTS public.admin_auth_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id         UUID REFERENCES public.admins(id) ON DELETE SET NULL,
  ip_address       TEXT,
  email_attempted  TEXT NOT NULL,
  success          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_auth_logs_admin_id   ON public.admin_auth_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_auth_logs_created_at ON public.admin_auth_logs(created_at DESC);

-- 3. Session store table for connect-pg-simple
--    (exact schema required by the library)
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  sid    VARCHAR NOT NULL COLLATE "default",
  sess   JSON    NOT NULL,
  expire TIMESTAMPTZ NOT NULL,
  CONSTRAINT admin_sessions_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expire ON public.admin_sessions(expire);
