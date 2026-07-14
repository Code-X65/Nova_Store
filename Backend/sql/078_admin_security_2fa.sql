-- 078_admin_security_2fa.sql
-- Two-factor authentication (TOTP) for admin accounts.
-- Stores 2FA state in a dedicated admin_security table; quick flag on users
-- for filtering without a join.

-- 1. Quick flag on users (avoids JOIN for "is 2FA enabled?" checks)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;

-- 2. Dedicated admin_security table for secrets and recovery material
CREATE TABLE IF NOT EXISTS admin_security (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  totp_secret       TEXT,                     -- encrypted at application layer
  recovery_codes    TEXT[],                   -- hashed at application layer
  backup_codes_used INT DEFAULT 0,
  last_verified_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_security_user ON admin_security(user_id);

-- 3. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_admin_security_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_admin_security_updated_at ON admin_security;
CREATE TRIGGER trg_admin_security_updated_at
  BEFORE UPDATE ON admin_security
  FOR EACH ROW EXECUTE FUNCTION update_admin_security_updated_at();

-- 4. Disable RLS
ALTER TABLE admin_security DISABLE ROW LEVEL SECURITY;
