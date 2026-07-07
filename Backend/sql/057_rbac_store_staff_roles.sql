-- ============================================================
-- Migration 057: RBAC Store Staff Roles
-- ============================================================
-- Implements the department-based staff role hierarchy:
--   STORE_OWNER  (replaces SUPER_ADMIN  — full wildcard access)
--   MANAGER      (replaces generic ADMIN — full store ops)
--   ORDER_STAFF  (order fulfillment pipeline only)
--   INVENTORY_STAFF (inventory + sales records)
--
-- Safe to run multiple times (all statements are idempotent).
-- ============================================================

-- ┌─────────────────────────────────────────────────────────────┐
-- │  PART 1 — Seed new staff roles                              │
-- └─────────────────────────────────────────────────────────────┘

INSERT INTO roles (name, display_name, description, color_code, is_system, is_default)
VALUES
  -- Store Owner: replaces SUPER_ADMIN semantically
  ('STORE_OWNER',      'Store Owner',      'Owner of the store — unrestricted access to all features',               '#7C3AED', true, false),
  -- Manager: replaces generic ADMIN
  ('MANAGER',          'Store Manager',    'Full store operations oversight — products, orders, inventory, coupons',  '#0EA5E9', true, false),
  -- Departmental staff
  ('ORDER_STAFF',      'Order Staff',      'Handles order fulfillment: confirm, process, dispatch, deliver',          '#10B981', true, false),
  ('INVENTORY_STAFF',  'Inventory Staff',  'Manages stock levels, adjustments, inventory records and sales reports',  '#F59E0B', true, false)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description  = EXCLUDED.description,
  color_code   = EXCLUDED.color_code;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  PART 2 — Seed new permissions                              │
-- └─────────────────────────────────────────────────────────────┘

INSERT INTO permissions (key, name, description, category)
VALUES
  -- Orders
  ('order:fulfill',     'Fulfill Orders',         'Process order fulfillment pipeline: confirm → dispatch → deliver', 'orders'),
  -- Customers (read-only, for delivery contact)
  ('customer:read',     'View Customers',          'View customer contact details needed for order delivery',          'customers'),
  -- Sales / Analytics
  ('sales:read',        'View Sales Reports',      'Access sales analytics, revenue data and sales charts',            'analytics'),
  -- Taxonomy
  ('category:manage',   'Manage Categories',       'Create, edit and delete product categories',                       'products'),
  ('brand:manage',      'Manage Brands',           'Create, edit and delete product brands',                           'products'),
  -- Coupon (granular — expand wildcard coupon:* into explicit keys)
  ('coupon:read',       'View Coupons',            'View discount codes and their usage statistics',                   'marketing'),
  ('coupon:create',     'Create Coupons',          'Create new discount codes and promotional campaigns',              'marketing'),
  ('coupon:write',      'Edit Coupons',            'Update existing discount codes',                                   'marketing'),
  ('coupon:delete',     'Delete Coupons',          'Remove discount codes from the store',                             'marketing'),
  -- Administration (invitation / role management with scope)
  ('admin:invite',      'Invite Staff',            'Send invitations to staff members',                                'admin'),
  ('role:manage',       'Manage Staff Roles',      'Update roles assigned to lower-tier staff members',                'admin')
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  PART 3 — Role-permission assignments                       │
-- └─────────────────────────────────────────────────────────────┘

-- ── 3a. STORE_OWNER — all permissions (including wildcard) ────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   roles r, permissions p
WHERE  r.name = 'STORE_OWNER'
ON CONFLICT DO NOTHING;


-- ── 3b. MANAGER — full store ops, can invite lower staff ──────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   roles r, permissions p
WHERE  r.name = 'MANAGER'
  AND  p.key IN (
    -- Orders
    'order:read', 'order:write', 'order:fulfill',
    -- Products
    'product:create', 'product:read', 'product:write', 'product:delete',
    -- Taxonomy
    'category:manage', 'brand:manage',
    -- Inventory
    'inventory:read', 'inventory:write', 'inventory:alert',
    -- Analytics
    'sales:read',
    -- Marketing
    'coupon:read', 'coupon:create', 'coupon:write', 'coupon:delete',
    -- Customers (for order delivery)
    'customer:read',
    -- Admin
    'admin:access', 'admin:invite', 'role:manage'
  )
ON CONFLICT DO NOTHING;


-- ── 3c. ORDER_STAFF — fulfillment pipeline only ───────────────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   roles r, permissions p
WHERE  r.name = 'ORDER_STAFF'
  AND  p.key IN (
    'order:read', 'order:write', 'order:fulfill',
    'customer:read',
    'sales:read',      -- cross-department read access (per Decision 5)
    'admin:access'
  )
ON CONFLICT DO NOTHING;


-- ── 3d. INVENTORY_STAFF — stock management + sales records ───────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   roles r, permissions p
WHERE  r.name = 'INVENTORY_STAFF'
  AND  p.key IN (
    'inventory:read', 'inventory:write', 'inventory:alert',
    'sales:read',
    'product:read',   -- read-only product list for inventory tracking
    'order:read',     -- cross-department read access (per Decision 5)
    'admin:access'
  )
ON CONFLICT DO NOTHING;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  PART 4 — users.role enum: add new values if using pg enum  │
-- └─────────────────────────────────────────────────────────────┘
-- Safe no-op if users.role is plain VARCHAR.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    BEGIN ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'STORE_OWNER';    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'MANAGER';        EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ORDER_STAFF';    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'INVENTORY_STAFF'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END;
$$;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  PART 5 — Migrate existing SUPER_ADMIN → STORE_OWNER        │
-- │           Migrate existing ADMIN       → MANAGER            │
-- └─────────────────────────────────────────────────────────────┘

-- 5a. Reassign user_roles entries for SUPER_ADMIN users
--     (move them to the new STORE_OWNER role)
UPDATE user_roles ur
SET    role_id = new_role.id
FROM   roles old_role,
       roles new_role
WHERE  ur.role_id  = old_role.id
  AND  old_role.name = 'SUPER_ADMIN'
  AND  new_role.name = 'STORE_OWNER';

-- 5b. Reassign user_roles entries for ADMIN users → MANAGER
UPDATE user_roles ur
SET    role_id = new_role.id
FROM   roles old_role,
       roles new_role
WHERE  ur.role_id  = old_role.id
  AND  old_role.name = 'admin'        -- matches the 005 seed: name = 'admin'
  AND  new_role.name = 'MANAGER';

-- 5c. Update the users.role column (VARCHAR) if it is used directly
UPDATE users
SET    role = 'STORE_OWNER'
WHERE  role IN ('SUPER_ADMIN')
  AND  EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'users' AND column_name = 'role');

UPDATE users
SET    role = 'MANAGER'
WHERE  role IN ('ADMIN', 'admin')
  AND  EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'users' AND column_name = 'role');

-- 5d. Mark old generic roles as non-system so they can eventually be deleted,
--     but keep them in the DB so references remain valid during transition.
UPDATE roles
SET    is_system = FALSE
WHERE  name IN ('SUPER_ADMIN', 'admin', 'moderator')
  AND  is_system = TRUE;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  PART 6 — Invitation table: add department_note column      │
-- └─────────────────────────────────────────────────────────────┘
-- Stores the human-readable role context at time of invite for
-- display in the invitation email (e.g. "Order Staff").

ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS role_display_name TEXT;

-- Backfill role_display_name for any existing invitations
UPDATE invitations i
SET    role_display_name = r.display_name
FROM   roles r
WHERE  i.role_id = r.id
  AND  i.role_display_name IS NULL;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  PART 7 — Verify: log role/permission counts               │
-- └─────────────────────────────────────────────────────────────┘

DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM roles
  WHERE name IN ('STORE_OWNER','MANAGER','ORDER_STAFF','INVENTORY_STAFF');
  RAISE NOTICE 'Staff roles present: % / 4 expected', v_count;

  SELECT COUNT(*) INTO v_count FROM role_permissions rp
  JOIN roles r ON r.id = rp.role_id
  WHERE r.name = 'STORE_OWNER';
  RAISE NOTICE 'STORE_OWNER permission count: %', v_count;

  SELECT COUNT(*) INTO v_count FROM role_permissions rp
  JOIN roles r ON r.id = rp.role_id
  WHERE r.name = 'MANAGER';
  RAISE NOTICE 'MANAGER permission count: %', v_count;

  SELECT COUNT(*) INTO v_count FROM role_permissions rp
  JOIN roles r ON r.id = rp.role_id
  WHERE r.name = 'ORDER_STAFF';
  RAISE NOTICE 'ORDER_STAFF permission count: %', v_count;

  SELECT COUNT(*) INTO v_count FROM role_permissions rp
  JOIN roles r ON r.id = rp.role_id
  WHERE r.name = 'INVENTORY_STAFF';
  RAISE NOTICE 'INVENTORY_STAFF permission count: %', v_count;
END;
$$;
