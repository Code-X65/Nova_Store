-- ============================================================
-- 068: Rider Management Module
-- ============================================================
-- Introduces a structured riders table so Store Owners and
-- Managers can enroll delivery personnel without issuing
-- individual login credentials. Riders are assigned to orders
-- via a rider_id foreign key on delivery_dispatches.
-- ============================================================

-- ── 1. Create riders table ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS riders (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  store_id              UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  first_name            TEXT NOT NULL,
  last_name             TEXT NOT NULL,
  phone                 TEXT NOT NULL,
  email                 TEXT,
  address_jsonb         JSONB,
  id_type               TEXT CHECK (id_type IN ('none', 'national_id', 'drivers_license', 'passport', 'other')),
  id_number             TEXT,
  vehicle_type          TEXT CHECK (vehicle_type IN ('none', 'motorcycle', 'bicycle', 'car', 'van', 'other')),
  vehicle_registration  TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_by            UUID REFERENCES users(id),
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_riders_store_id   ON riders(store_id);
CREATE INDEX IF NOT EXISTS idx_riders_is_active  ON riders(is_active);
CREATE INDEX IF NOT EXISTS idx_riders_phone      ON riders(phone);

ALTER TABLE riders DISABLE ROW LEVEL SECURITY;

-- ── 2. Extend delivery_dispatches to support structured rider assignment ──────

ALTER TABLE delivery_dispatches
  ADD COLUMN IF NOT EXISTS rider_id    UUID REFERENCES riders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rider_name  TEXT,
  ADD COLUMN IF NOT EXISTS rider_phone TEXT;

CREATE INDEX IF NOT EXISTS idx_delivery_dispatches_rider_id ON delivery_dispatches(rider_id);

-- ── 3. Seed permissions for rider management ──────────────────────────────────

INSERT INTO permissions (key, name, description, category)
VALUES
  ('rider:read',  'View Riders',     'View rider profiles and assignment history', 'riders'),
  ('rider:write', 'Manage Riders',   'Enroll, update, and deactivate riders',     'riders'),
  ('rider:assign','Assign Riders',   'Assign riders to orders (single and batch)', 'riders')
ON CONFLICT (key) DO NOTHING;
