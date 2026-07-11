-- 059_seed_missing_permissions.sql
-- Seeds permission keys referenced by frontend guards or backend route files
-- that were previously missing from the permissions table.

-- ─── 1. Insert / upsert all needed permission keys ───────────────────────────
INSERT INTO permissions (key, name, description, category)
VALUES
  -- Catalog
  ('product:read',         'Read Products',               'View product listings and details',                        'products'),
  ('category:read',        'Read Categories',             'View product category listings and details',               'products'),
  ('category:write',       'Write Categories',            'Update and delete product categories',                     'products'),
  ('category:create',      'Create Categories',           'Create new product categories',                            'products'),
  ('brand:read',           'Read Brands',                 'View product brand listings and details',                  'products'),
  ('brand:write',          'Write Brands',                'Update and delete product brands',                         'products'),
  ('brand:create',         'Create Brands',               'Create new product brands',                                'products'),

  -- Analytics / Sales
  ('analytics:read',       'View Analytics',              'Access telemetry dashboards and revenue data',             'analytics'),
  ('sales:read',           'View Sales Reports',          'Access sales reports, daily summaries and top products',   'analytics'),

  -- Orders
  ('order:read',           'Read Orders',                 'View orders across all statuses',                          'orders'),
  ('order:write',          'Manage Orders',               'Update order status and fulfillment',                      'orders'),

  -- Coupons (split: read vs write)
  ('coupon:read',          'Read Coupons',                'View coupon list, details and usage analytics',            'promotions'),
  ('coupon:write',         'Manage Coupons',              'Create, update, deactivate and delete coupons',            'promotions'),

  -- Shipping (split: read vs write)
  ('shipping:read',        'Read Shipping',               'View shipping zones and rates',                            'shipping'),
  ('shipping:write',       'Manage Shipping',             'Create, update and delete shipping zones and rates',       'shipping'),

  -- Reviews (split: read vs write)
  ('review:read',          'Read Reviews',                'View product reviews across all statuses',                 'reviews'),
  ('review:write',         'Moderate Reviews',            'Approve, reject, delete and bulk-action product reviews',  'reviews'),

  -- Settings
  ('settings:read',        'Read Settings',               'View global store configurations',                         'admin'),
  ('settings:write',       'Write Settings',              'Update global store configurations',                       'admin'),

  -- Audit
  ('audit:read',           'Read Audit Logs',             'View admin authentication and activity audit logs',        'admin'),

  -- Staff management
  ('staff:read',           'Read Staff',                  'View staff directory and invitations',                     'admin'),
  ('staff:write',          'Manage Staff',                'Invite staff members and manage permissions',              'admin'),
  ('role:manage',          'Manage Roles',                'Assign and update roles for admin users',                  'admin'),

  -- Notifications
  ('notifications:write',  'Manage Notifications',        'Send broadcasts and manage notification templates',        'admin'),

  -- Inventory
  ('inventory:read',       'Read Inventory',              'View stock levels, transactions and low-stock alerts',     'inventory'),
  ('inventory:write',      'Adjust Inventory',            'Perform stock adjustments',                                'inventory'),
  ('inventory:alert',      'Manage Inventory Alerts',     'Configure low-stock thresholds and alert settings',        'inventory')

ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category;


-- ─── 2. Assign permissions to MANAGER ────────────────────────────────────────
DO $$
DECLARE
  v_role_id UUID;
BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = 'MANAGER';
  IF v_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, p.id
    FROM permissions p
    WHERE p.key IN (
      -- Catalog
      'product:read', 'category:read', 'category:write', 'category:create',
      'brand:read', 'brand:write', 'brand:create',
      -- Analytics / Sales
      'analytics:read', 'sales:read',
      -- Orders
      'order:read', 'order:write',
      -- Coupons
      'coupon:read', 'coupon:write',
      -- Shipping
      'shipping:read', 'shipping:write',
      -- Reviews
      'review:read', 'review:write',
      -- Settings
      'settings:read', 'settings:write',
      -- Audit
      'audit:read',
      -- Staff / Roles
      'staff:read', 'staff:write', 'role:manage',
      -- Notifications
      'notifications:write',
      -- Inventory
      'inventory:read', 'inventory:write', 'inventory:alert'
    )
    ON CONFLICT DO NOTHING;
    RAISE NOTICE 'MANAGER permissions assigned.';
  ELSE
    RAISE WARNING 'MANAGER role not found — skipping.';
  END IF;
END $$;


-- ─── 3. Assign permissions to ORDER_STAFF ────────────────────────────────────
DO $$
DECLARE
  v_role_id UUID;
BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = 'ORDER_STAFF';
  IF v_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, p.id
    FROM permissions p
    WHERE p.key IN (
      'order:read', 'order:write',
      'review:read'
    )
    ON CONFLICT DO NOTHING;
    RAISE NOTICE 'ORDER_STAFF permissions assigned.';
  ELSE
    RAISE WARNING 'ORDER_STAFF role not found — skipping.';
  END IF;
END $$;


-- ─── 4. Assign permissions to INVENTORY_STAFF ────────────────────────────────
DO $$
DECLARE
  v_role_id UUID;
BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = 'INVENTORY_STAFF';
  IF v_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, p.id
    FROM permissions p
    WHERE p.key IN (
      'product:read',
      'inventory:read', 'inventory:write', 'inventory:alert'
    )
    ON CONFLICT DO NOTHING;
    RAISE NOTICE 'INVENTORY_STAFF permissions assigned.';
  ELSE
    RAISE WARNING 'INVENTORY_STAFF role not found — skipping.';
  END IF;
END $$;
