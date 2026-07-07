-- ============================================================
-- Migration 053: Single-Store Architecture — Create Stores Table
-- ============================================================
-- Creates:
--   1. stores           — core store identity + profile
--   2. store_settings   — flexible key/value config per store
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. Stores Table ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stores (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

  -- ── Identity ──────────────────────────────────────────────
  name        TEXT NOT NULL,                          -- Display name: "Nova Store"
  slug        TEXT UNIQUE NOT NULL,                   -- URL-safe identifier: "nova-store"
  tagline     TEXT,                                   -- Short marketing line: "Shop smarter"
  description TEXT,                                   -- Longer about-the-store text

  -- ── Contact & Communication ───────────────────────────────
  email       TEXT,                                   -- Public contact email
  phone       TEXT,                                   -- Public contact phone
  whatsapp    TEXT,                                   -- WhatsApp business number (optional)
  website_url TEXT,                                   -- Store website / landing page

  -- ── Physical Address ──────────────────────────────────────
  -- Stored as JSONB so it can handle any address format now
  -- and be normalised into columns later if needed.
  -- Expected shape:
  --   { "street": "12 Bode Thomas St", "city": "Lagos",
  --     "state": "Lagos", "country": "Nigeria",
  --     "postal_code": "100001", "landmark": "..." }
  address     JSONB DEFAULT '{}'::jsonb,

  -- ── Branding & Media ──────────────────────────────────────
  logo_url    TEXT,                                   -- Square logo (used in navbar, emails)
  banner_url  TEXT,                                   -- Wide banner (storefront hero)
  favicon_url TEXT,                                   -- Browser tab icon
  primary_color   TEXT DEFAULT '#000000',             -- Hex brand colour (UI theming)
  secondary_color TEXT DEFAULT '#ffffff',             -- Hex secondary colour

  -- ── Social Media ──────────────────────────────────────────
  -- Optional; NULL = not set
  social_links JSONB DEFAULT '{}'::jsonb,
  -- Expected shape:
  --   { "instagram": "https://instagram.com/novastore",
  --     "twitter":   "https://twitter.com/novastore",
  --     "facebook":  "https://facebook.com/novastore",
  --     "tiktok":    "https://tiktok.com/@novastore",
  --     "youtube":   "https://youtube.com/@novastore" }

  -- ── Business Info ─────────────────────────────────────────
  business_registration_number TEXT,                  -- CAC / company reg number
  tax_id                       TEXT,                  -- VAT / TIN number
  business_type TEXT DEFAULT 'retail'
    CHECK (business_type IN ('retail','wholesale','dropshipping','marketplace','other')),

  -- ── Business Hours ────────────────────────────────────────
  -- Expected shape (all 7 days, 24h time):
  --   { "monday":    { "open": "09:00", "close": "18:00", "is_closed": false },
  --     "tuesday":   { "open": "09:00", "close": "18:00", "is_closed": false },
  --     ...
  --     "sunday":    { "is_closed": true } }
  business_hours JSONB DEFAULT '{}'::jsonb,

  -- ── Locale & Regional Settings ────────────────────────────
  timezone    TEXT    NOT NULL DEFAULT 'Africa/Lagos',
  currency    TEXT    NOT NULL DEFAULT 'NGN',         -- ISO-4217
  country     TEXT    NOT NULL DEFAULT 'Nigeria',
  language    TEXT    NOT NULL DEFAULT 'en',

  -- ── Operational Flags ─────────────────────────────────────
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  is_maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE, -- Temporarily close storefront
  accepts_guest_orders BOOLEAN NOT NULL DEFAULT TRUE,

  -- ── Return Policy ─────────────────────────────────────────
  return_window_days INT NOT NULL DEFAULT 7,          -- Days customer has to request return
  return_policy_text TEXT,                            -- Full return policy prose

  -- ── Ownership ─────────────────────────────────────────────
  created_by  UUID NOT NULL REFERENCES users(id),     -- SUPER_ADMIN who owns this store

  -- ── Timestamps ────────────────────────────────────────────
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_slug     ON stores(slug);
CREATE INDEX        IF NOT EXISTS idx_stores_active   ON stores(is_active) WHERE is_active = TRUE;
CREATE INDEX        IF NOT EXISTS idx_stores_created_by ON stores(created_by);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_stores_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stores_updated_at ON stores;
CREATE TRIGGER trg_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_stores_updated_at();

-- Disable RLS (backend-managed service role)
ALTER TABLE stores DISABLE ROW LEVEL SECURITY;


-- ── 2. Store Settings Table ────────────────────────────────────────────────────
-- Flexible key/value extension for store config that doesn't warrant
-- dedicated columns on the stores table (e.g. feature flags, payment
-- gateway keys, notification prefs, integrations).

CREATE TABLE IF NOT EXISTS store_settings (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,                           -- e.g. 'payment_gateway', 'smtp_host'
  value      JSONB NOT NULL,                          -- Flexible: string, object, bool, etc.
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, key)
);

CREATE INDEX IF NOT EXISTS idx_store_settings_store_id ON store_settings(store_id);
CREATE INDEX IF NOT EXISTS idx_store_settings_key      ON store_settings(store_id, key);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_store_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_settings_updated_at ON store_settings;
CREATE TRIGGER trg_store_settings_updated_at
  BEFORE UPDATE ON store_settings
  FOR EACH ROW EXECUTE FUNCTION update_store_settings_updated_at();

-- Disable RLS
ALTER TABLE store_settings DISABLE ROW LEVEL SECURITY;
