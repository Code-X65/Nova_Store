-- ============================================================
-- 070: Enhanced Rider Management Module
-- ============================================================
-- Extends the riders table with biometric photos, structured
-- address fields, status/approval workflow columns, and
-- secondary contact/document uploads. Also adds rider_guarantors
-- table (up to 2 per rider) and additional permissions.
-- ============================================================

-- ── 1. Extend riders table ────────────────────────────────────────────────────

ALTER TABLE riders
  ADD COLUMN IF NOT EXISTS photo_frontal      TEXT,
  ADD COLUMN IF NOT EXISTS photo_left_profile  TEXT,
  ADD COLUMN IF NOT EXISTS photo_right_profile TEXT,
  ADD COLUMN IF NOT EXISTS phone_secondary    TEXT,
  ADD COLUMN IF NOT EXISTS id_doc_url         TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_doc_url    TEXT,
  ADD COLUMN IF NOT EXISTS country            TEXT DEFAULT 'Nigeria',
  ADD COLUMN IF NOT EXISTS state              TEXT,
  ADD COLUMN IF NOT EXISTS city               TEXT,
  ADD COLUMN IF NOT EXISTS street_address     TEXT,
  ADD COLUMN IF NOT EXISTS status             TEXT NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval', 'live', 'suspended')),
  ADD COLUMN IF NOT EXISTS approved_by        UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_at        TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS rejection_reason   TEXT;

-- Index the new status column so pending dashboards stay fast
CREATE INDEX IF NOT EXISTS idx_riders_status ON riders(status);

-- Backfill existing active riders to 'live'
UPDATE riders
   SET status = 'live'
 WHERE is_active = true
   AND (status IS NULL OR status = 'pending_approval');

-- Backfill structured address from address_jsonb for existing rows
UPDATE riders
   SET country = COALESCE(country, (address_jsonb->>'country')::text, 'Nigeria'),
       state   = COALESCE(state,   (address_jsonb->>'state')::text),
       city    = COALESCE(city,    (address_jsonb->>'city')::text),
       street_address = COALESCE(street_address, (address_jsonb->>'street')::text)
 WHERE address_jsonb IS NOT NULL
   AND (country IS NULL OR state IS NULL);

-- ── 2. Rider guarantors table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rider_guarantors (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  rider_id          UUID NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  full_name         TEXT NOT NULL,
  relationship      TEXT NOT NULL,
  phone             TEXT NOT NULL,
  address           TEXT NOT NULL,
  id_type           TEXT CHECK (id_type IN ('national_id','drivers_license','passport','other')),
  id_number         TEXT,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rider_guarantors_rider_id ON rider_guarantors(rider_id);

ALTER TABLE rider_guarantors DISABLE ROW LEVEL SECURITY;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_rider_guarantors_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rider_guarantors_updated_at ON rider_guarantors;
CREATE TRIGGER trg_rider_guarantors_updated_at
  BEFORE UPDATE ON rider_guarantors
  FOR EACH ROW EXECUTE FUNCTION update_rider_guarantors_updated_at();

-- ── 3. Additional permissions ────────────────────────────────────────────────

INSERT INTO permissions (key, name, description, category)
VALUES
  ('rider:approve', 'Approve Riders',  'Review and approve pending rider enrollments', 'riders'),
  ('rider:suspend',  'Suspend Riders',  'Suspend or reactivate enrolled riders',       'riders')
ON CONFLICT (key) DO NOTHING;

-- STORE_OWNER / MANAGER: can approve and suspend
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   roles r, permissions p
WHERE  r.name IN ('STORE_OWNER', 'MANAGER')
  AND  p.key IN ('rider:approve', 'rider:suspend')
ON CONFLICT DO NOTHING;

-- ── 4. Verification ──────────────────────────────────────────────────────────

DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM riders WHERE status IS NOT NULL;
  RAISE NOTICE 'Riders with status backfill/update count: %', v_count;

  SELECT COUNT(*) INTO v_count FROM rider_guarantors;
  RAISE NOTICE 'Rider guarantors seeded: %', v_count;

  SELECT COUNT(*) INTO v_count FROM role_permissions rp
  JOIN permissions p ON p.id = rp.permission_id
  WHERE p.key IN ('rider:approve', 'rider:suspend');
  RAISE NOTICE 'Role-permissions for new rider slugs: %', v_count;
END;
$$;
