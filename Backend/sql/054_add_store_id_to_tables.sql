-- ============================================================
-- Migration 054: Single-Store Architecture — Add store_id to Tables
-- ============================================================
-- Part A: Add store_id column (nullable FK) to all major entity tables
-- Part B: Seed default "Nova Store" and backfill all existing rows
-- Part C: Apply NOT NULL constraint (where appropriate) and add indexes
-- ============================================================

-- ┌─────────────────────────────────────────────────────────────┐
-- │  PART A — Add nullable store_id columns                     │
-- └─────────────────────────────────────────────────────────────┘

-- users: Admin/staff users belong to a store.
--        Regular customers will have store_id = NULL (global).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;

-- products: Core catalog scoped to a store.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

-- product_categories: Store-specific taxonomy.
ALTER TABLE product_categories
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

-- product_brands: Store-specific brand management.
ALTER TABLE product_brands
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

-- orders: Every order placed at a specific store.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;

-- carts: Guest and authenticated carts scoped to a store.
ALTER TABLE carts
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;

-- wishlists: Customer wishlists scoped to a store.
--            (wishlist_items are always reachable via wishlist.store_id)
ALTER TABLE wishlists
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;

-- coupons: Discount codes are store-specific.
ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

-- inventory_transactions: Stock movements scoped to a store.
ALTER TABLE inventory_transactions
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;

-- inventory_reservations: Checkout holds scoped to a store.
ALTER TABLE inventory_reservations
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;

-- invitations: Admin invitations are always sent for a specific store.
ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  PART B — Seed default store + backfill all existing rows   │
-- └─────────────────────────────────────────────────────────────┘

DO $$
DECLARE
  v_super_admin_id UUID;
  v_store_id       UUID;
BEGIN

  -- Resolve the existing SUPER_ADMIN user
  SELECT id INTO v_super_admin_id
  FROM users
  WHERE email = 'admin@novastore.com'
  LIMIT 1;

  IF v_super_admin_id IS NULL THEN
    RAISE EXCEPTION 'SUPER_ADMIN user (admin@novastore.com) not found. '
                    'Run migration 025_seed_admin_user.sql first.';
  END IF;

  -- ── Create the default "Nova Store" ──────────────────────────
  INSERT INTO stores (
    name,
    slug,
    tagline,
    description,
    email,
    phone,
    address,
    logo_url,
    business_type,
    timezone,
    currency,
    country,
    language,
    is_active,
    return_window_days,
    created_by
  )
  VALUES (
    'Nova Store',
    'nova-store',
    'Shop smarter. Shop Nova.',
    'Nova Store is your one-stop destination for quality products at great prices.',
    'admin@novastore.com',
    NULL,
    '{"street": "", "city": "Lagos", "state": "Lagos", "country": "Nigeria", "postal_code": ""}'::jsonb,
    NULL,   -- logo_url: set via admin dashboard
    'retail',
    'Africa/Lagos',
    'NGN',
    'Nigeria',
    'en',
    TRUE,
    7,
    v_super_admin_id
  )
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO v_store_id;

  -- If the store already existed (re-run scenario), fetch its id
  IF v_store_id IS NULL THEN
    SELECT id INTO v_store_id FROM stores WHERE slug = 'nova-store';
  END IF;

  RAISE NOTICE 'Default store id: %', v_store_id;

  -- ── Seed default store_settings from the stores table itself ──
  -- These can be overridden via the admin dashboard later.
  INSERT INTO store_settings (store_id, key, value) VALUES
    (v_store_id, 'currency',           '"NGN"'::jsonb),
    (v_store_id, 'timezone',           '"Africa/Lagos"'::jsonb),
    (v_store_id, 'return_window_days', '7'::jsonb),
    (v_store_id, 'guest_checkout',     'true'::jsonb),
    (v_store_id, 'low_stock_threshold','10'::jsonb),
    (v_store_id, 'order_prefix',       '"ORD"'::jsonb),
    (v_store_id, 'maintenance_mode',   'false'::jsonb)
  ON CONFLICT (store_id, key) DO NOTHING;

  -- ── Backfill: SUPER_ADMIN user ────────────────────────────────
  -- Recommendation from plan: set store_id on SUPER_ADMIN; bypass
  -- scoping in code via role check, not NULL check.
  UPDATE users
  SET store_id = v_store_id
  WHERE id = v_super_admin_id
    AND store_id IS NULL;

  -- ── Backfill: all other existing admin/staff users ────────────
  -- Regular customers keep store_id = NULL (global browsing).
  UPDATE users
  SET store_id = v_store_id
  WHERE role IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
    AND store_id IS NULL;

  -- ── Backfill: products ────────────────────────────────────────
  UPDATE products
  SET store_id = v_store_id
  WHERE store_id IS NULL;

  -- ── Backfill: product_categories ─────────────────────────────
  UPDATE product_categories
  SET store_id = v_store_id
  WHERE store_id IS NULL;

  -- ── Backfill: product_brands ──────────────────────────────────
  UPDATE product_brands
  SET store_id = v_store_id
  WHERE store_id IS NULL;

  -- ── Backfill: orders ──────────────────────────────────────────
  UPDATE orders
  SET store_id = v_store_id
  WHERE store_id IS NULL;

  -- ── Backfill: carts ───────────────────────────────────────────
  UPDATE carts
  SET store_id = v_store_id
  WHERE store_id IS NULL;

  -- ── Backfill: wishlists ───────────────────────────────────────
  UPDATE wishlists
  SET store_id = v_store_id
  WHERE store_id IS NULL;

  -- ── Backfill: coupons ─────────────────────────────────────────
  UPDATE coupons
  SET store_id = v_store_id
  WHERE store_id IS NULL;

  -- ── Backfill: inventory_transactions ─────────────────────────
  UPDATE inventory_transactions
  SET store_id = v_store_id
  WHERE store_id IS NULL;

  -- ── Backfill: inventory_reservations ─────────────────────────
  UPDATE inventory_reservations
  SET store_id = v_store_id
  WHERE store_id IS NULL;

  -- ── Backfill: invitations ─────────────────────────────────────
  UPDATE invitations
  SET store_id = v_store_id
  WHERE store_id IS NULL;

  RAISE NOTICE 'Backfill complete for default store %', v_store_id;
END;
$$;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  PART C — NOT NULL constraints + performance indexes        │
-- └─────────────────────────────────────────────────────────────┘

-- Apply NOT NULL now that every existing row has a store_id.
-- NOTE: users.store_id intentionally stays NULLABLE for regular customers.

ALTER TABLE products             ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE product_categories   ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE product_brands       ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE coupons              ALTER COLUMN store_id SET NOT NULL;

-- Orders, carts, wishlists, inventory_* and invitations stay nullable
-- so that existing guest carts / anonymous rows don't break; the
-- application layer will always set store_id going forward.
-- You can tighten these to NOT NULL once you confirm 100% backfill coverage.

-- ── Indexes ────────────────────────────────────────────────────────────────────

-- users: find all staff/admin for a store
CREATE INDEX IF NOT EXISTS idx_users_store_id
  ON users(store_id)
  WHERE store_id IS NOT NULL;

-- products: the most frequently queried scope
CREATE INDEX IF NOT EXISTS idx_products_store_id
  ON products(store_id);

CREATE INDEX IF NOT EXISTS idx_products_store_status
  ON products(store_id, status)
  WHERE status = 'published';

-- product_categories
CREATE INDEX IF NOT EXISTS idx_product_categories_store_id
  ON product_categories(store_id);

-- product_brands
CREATE INDEX IF NOT EXISTS idx_product_brands_store_id
  ON product_brands(store_id);

-- orders: most common dashboard query = orders for a store
CREATE INDEX IF NOT EXISTS idx_orders_store_id
  ON orders(store_id)
  WHERE store_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_store_status
  ON orders(store_id, status)
  WHERE store_id IS NOT NULL;

-- carts
CREATE INDEX IF NOT EXISTS idx_carts_store_id
  ON carts(store_id)
  WHERE store_id IS NOT NULL;

-- wishlists
CREATE INDEX IF NOT EXISTS idx_wishlists_store_id
  ON wishlists(store_id)
  WHERE store_id IS NOT NULL;

-- coupons
CREATE INDEX IF NOT EXISTS idx_coupons_store_id
  ON coupons(store_id);

-- inventory_transactions
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_store_id
  ON inventory_transactions(store_id)
  WHERE store_id IS NOT NULL;

-- inventory_reservations
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_store_id
  ON inventory_reservations(store_id)
  WHERE store_id IS NOT NULL;

-- invitations: find all pending invitations for a store
CREATE INDEX IF NOT EXISTS idx_invitations_store_id
  ON invitations(store_id)
  WHERE store_id IS NOT NULL;
