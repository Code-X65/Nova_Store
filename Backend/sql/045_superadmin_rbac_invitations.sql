-- ============================================================
-- Migration 045: SuperAdmin RBAC + Invitation System
-- ============================================================
-- Creates:
--   1. invitations table (invitation token flow)
--   2. SUPER_ADMIN role with wildcard (*) permission
--   3. Deprecation comment on admins table
-- ============================================================

-- 1. Ensure uuid extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create invitations table
CREATE TABLE IF NOT EXISTS invitations (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email        VARCHAR(255) NOT NULL,
  token        CHAR(64)     NOT NULL UNIQUE,
  role_id      UUID         REFERENCES roles(id) ON DELETE RESTRICT,
  permissions  JSONB        DEFAULT '[]'::jsonb,
  invited_by   UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at   TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at  TIMESTAMP WITH TIME ZONE,
  status       VARCHAR(20)  DEFAULT 'pending'
               CHECK (status IN ('pending','accepted','expired','revoked')),
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_invitations_token      ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email      ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_status     ON invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_invited_by ON invitations(invited_by);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON invitations(expires_at)
  WHERE status = 'pending';

-- Disable RLS (backend service role manages access)
ALTER TABLE invitations DISABLE ROW LEVEL SECURITY;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_invitations_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invitations_updated_at ON invitations;
CREATE TRIGGER trg_invitations_updated_at
  BEFORE UPDATE ON invitations
  FOR EACH ROW EXECUTE FUNCTION update_invitations_updated_at();

-- ============================================================
-- 3. Add SUPER_ADMIN role (idempotent)
-- ============================================================
INSERT INTO roles (id, name, description, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'SUPER_ADMIN',
  'Full system access — can invite and manage all admins',
  NOW(), NOW()
)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 4. Ensure wildcard permission '*' exists
-- ============================================================
INSERT INTO permissions (key, name, description, created_at)
VALUES ('*', 'Wildcard — full system access', 'Wildcard — full system access', NOW())
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 5. Grant SUPER_ADMIN all existing permissions
-- ============================================================
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT '00000000-0000-0000-0000-000000000001', p.id, NOW()
FROM permissions p
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. Mark admins table as deprecated
-- ============================================================
COMMENT ON TABLE admins IS
  'DEPRECATED — identities migrated to users + user_roles. '
  'Will be dropped after migration grace period (see migration strategy in docs).';

-- ============================================================
-- 7. Add SUPER_ADMIN as a valid value for users.role enum/column
--    (only runs if users.role is a plain VARCHAR — safe for enum col too)
-- ============================================================
DO $$
BEGIN
  -- If role is a pg enum, add the value; if it is VARCHAR, this is a no-op
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'user_role'
  ) THEN
    BEGIN
      ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END;
$$;
