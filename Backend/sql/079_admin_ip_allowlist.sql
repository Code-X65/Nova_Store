-- 079_admin_ip_allowlist.sql
-- Restrict admin authentication to approved IP ranges per role.
-- Used by ip-allowlist.middleware.js to gate sensitive admin routes.

CREATE TABLE IF NOT EXISTS admin_ip_allowlist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_cidr     TEXT NOT NULL,                              -- e.g. "192.168.1.0/24" or "10.0.0.1"
  label       TEXT,                                       -- human description
  role_scope  TEXT[] NOT NULL DEFAULT '{STORE_OWNER,MANAGER}',  -- which roles this entry applies to
  is_active   BOOLEAN DEFAULT TRUE,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ip_allowlist_active ON admin_ip_allowlist(is_active) WHERE is_active = TRUE;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_ip_allowlist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ip_allowlist_updated_at ON admin_ip_allowlist;
CREATE TRIGGER trg_ip_allowlist_updated_at
  BEFORE UPDATE ON admin_ip_allowlist
  FOR EACH ROW EXECUTE FUNCTION update_ip_allowlist_updated_at();

ALTER TABLE admin_ip_allowlist DISABLE ROW LEVEL SECURITY;

-- Seed: allow localhost and private ranges for SUPER_ADMIN / STORE_OWNER and MANAGER
INSERT INTO admin_ip_allowlist (ip_cidr, label, role_scope, is_active)
VALUES
  ('127.0.0.1/32', 'Localhost', '{STORE_OWNER,MANAGER,SUPER_ADMIN}', true),
  ('10.0.0.0/8', 'Private 10.x', '{STORE_OWNER,MANAGER,SUPER_ADMIN}', true),
  ('172.16.0.0/12', 'Private 172.16-31.x', '{STORE_OWNER,MANAGER,SUPER_ADMIN}', true),
  ('192.168.0.0/16', 'Private 192.168.x', '{STORE_OWNER,MANAGER,SUPER_ADMIN}', true)
ON CONFLICT DO NOTHING;
