-- ============================================================
-- Migration: 076_catalog_inventory_governance.sql
-- Phase 1 of the Admin Dashboard blueprint:
--   * Variant option matrix (canonical Size/Color -> variant mapping)
--   * Warehouses + multi-location stock (inventory_levels)
--   * Stock alert rules (threshold / channel / recipient)
--   * Bulk import job tracking (Excel ingestion)
-- NOTE: product_categories already supports a tree (parent_id, slug,
--       level, full_path, is_active) and GET /categories?type=tree exists,
--       so no schema change is required there.
-- ============================================================

-- 1. Variant option matrix ------------------------------------------------
CREATE TABLE IF NOT EXISTS product_options (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,                 -- "Size", "Color"
  display_order INT DEFAULT 0,
  UNIQUE (product_id, name)
);

CREATE TABLE IF NOT EXISTS product_option_values (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id  UUID NOT NULL REFERENCES product_options(id) ON DELETE CASCADE,
  value      TEXT NOT NULL,
  position   INT DEFAULT 0,
  UNIQUE (option_id, value)
);

-- product_variants.option_values (freeform JSONB) becomes derived via this map
CREATE TABLE IF NOT EXISTS product_variant_options (
  variant_id       UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  option_value_id  UUID NOT NULL REFERENCES product_option_values(id) ON DELETE CASCADE,
  PRIMARY KEY (variant_id, option_value_id)
);

CREATE INDEX IF NOT EXISTS idx_product_options_product ON product_options(product_id);
CREATE INDEX IF NOT EXISTS idx_product_option_values_option ON product_option_values(option_id);
CREATE INDEX IF NOT EXISTS idx_product_variant_options_variant ON product_variant_options(variant_id);

-- Best-effort backfill: convert legacy product_variants.option_values JSONB
-- ({ "Size": "L", "Color": "Red" }) into the canonical matrix. Non-fatal.
DO $$
DECLARE
  v RECORD;
  opt RECORD;
  opt_id UUID;
  val_id UUID;
BEGIN
  FOR v IN SELECT id, product_id, option_values FROM product_variants
           WHERE option_values IS NOT NULL AND option_values <> '{}'::jsonb LOOP
    FOR opt IN SELECT * FROM jsonb_each_text(v.option_values) LOOP
      -- upsert option
      INSERT INTO product_options (product_id, name)
        VALUES (v.product_id, opt.key)
        ON CONFLICT (product_id, name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id INTO opt_id;
      -- upsert option value
      INSERT INTO product_option_values (option_id, value)
        VALUES (opt_id, opt.value)
        ON CONFLICT (option_id, value) DO UPDATE SET value = EXCLUDED.value
        RETURNING id INTO val_id;
      -- link variant -> value
      INSERT INTO product_variant_options (variant_id, option_value_id)
        VALUES (v.id, val_id)
        ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Variant option backfill skipped: %', SQLERRM;
END $$;

-- 2. Warehouses + multi-location stock -------------------------------------
CREATE TABLE IF NOT EXISTS warehouses (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code      TEXT UNIQUE NOT NULL,
  name      TEXT NOT NULL,
  location  TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_levels (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID REFERENCES products(id) ON DELETE CASCADE,
  variant_id   UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  quantity     INT NOT NULL DEFAULT 0,
  reserved     INT NOT NULL DEFAULT 0,
  low_stock_threshold INT DEFAULT 10,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT inv_levels_target CHECK (product_id IS NOT NULL OR variant_id IS NOT NULL),
  UNIQUE (product_id, variant_id, warehouse_id)
);

CREATE INDEX IF NOT EXISTS idx_inv_levels_product ON inventory_levels(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_levels_variant ON inventory_levels(variant_id);
CREATE INDEX IF NOT EXISTS idx_inv_levels_warehouse ON inventory_levels(warehouse_id);

-- Keep the legacy products.stock_quantity aggregate in sync with inventory_levels
CREATE OR REPLACE FUNCTION sync_product_stock_from_levels() RETURNS trigger AS $$
DECLARE
  pid UUID;
BEGIN
  pid := COALESCE(NEW.product_id, OLD.product_id);
  IF pid IS NOT NULL THEN
    UPDATE products p SET stock_quantity = (
      SELECT COALESCE(SUM(quantity - reserved), 0)
      FROM inventory_levels il
      WHERE il.product_id = p.id
    ) WHERE p.id = pid;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_product_stock ON inventory_levels;
CREATE TRIGGER trg_sync_product_stock
  AFTER INSERT OR UPDATE OR DELETE ON inventory_levels
  FOR EACH ROW EXECUTE FUNCTION sync_product_stock_from_levels();

-- 3. Stock alert rules ------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_alert_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope         TEXT NOT NULL DEFAULT 'product'
                 CHECK (scope IN ('product','variant','warehouse','global')),
  product_id    UUID REFERENCES products(id) ON DELETE CASCADE,
  variant_id    UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  warehouse_id  UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  threshold     INT NOT NULL,
  channels      TEXT[] NOT NULL DEFAULT '{in_app,email}',
  recipient_role TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_alert_rules_product ON stock_alert_rules(product_id);

-- 4. Bulk import jobs (Excel ingestion) ------------------------------------
CREATE TABLE IF NOT EXISTS import_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   TEXT NOT NULL CHECK (entity_type IN ('product','variant','inventory','category')),
  file_format   TEXT NOT NULL DEFAULT 'xlsx' CHECK (file_format IN ('xlsx','xls')),
  status        TEXT NOT NULL DEFAULT 'queued'
                 CHECK (status IN ('queued','processing','completed','failed','partial')),
  total_rows    INT DEFAULT 0,
  processed_rows INT DEFAULT 0,
  error_rows    INT DEFAULT 0,
  error_file_url TEXT,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);

-- Disable RLS (backend-managed access control)
ALTER TABLE product_options DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_option_values DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_variant_options DISABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_levels DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_alert_rules DISABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs DISABLE ROW LEVEL SECURITY;
