-- 081_rbac_new_roles.sql
-- Phase 3: extend the permission catalog and seed the 6 target roles.
--   SUPER_ADMIN, CATALOG_MANAGER, LOGISTICS_COORDINATOR,
--   CUSTOMER_SUPPORT, FINANCE_AUDITOR, MARKETING_SPECIALIST
-- Keep STORE_OWNER as a wildcard alias of SUPER_ADMIN for backward compat.

-- ─── 1. New target roles ─────────────────────────────────────────────────────
INSERT INTO roles (name, display_name, description, color_code, is_system, is_default)
VALUES
  ('SUPER_ADMIN',           'Super Admin',           'Unrestricted platform access',                            '#7C3AED', true, false),
  ('CATALOG_MANAGER',        'Catalog Manager',        'Manages products, categories, brands, and pricing',       '#3B82F6', true, false),
  ('LOGISTICS_COORDINATOR',  'Logistics Coordinator',  'Manages shipping zones, riders, fulfillment, and reverse logistics', '#10B981', true, false),
  ('CUSTOMER_SUPPORT',       'Customer Support',       'Handles customer tickets, reviews, and onboarding',       '#F59E0B', true, false),
  ('FINANCE_AUDITOR',        'Finance & Audit',        'Read-only access to financial reports and audit trails',  '#8B5CF6', true, false),
  ('MARKETING_SPECIALIST',   'Marketing Specialist',   'Manages promotions, coupons, campaigns, and segments',    '#EC4899', true, false)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description  = EXCLUDED.description;

-- ─── 2. Extended permission catalog (NGN-only, no tax domain) ───────────────
INSERT INTO permissions (key, name, description, category)
VALUES
  -- System
  ('system:read',    'Read System Settings',    'View system configuration',           'system'),
  ('system:write',   'Write System Settings',   'Update system configuration',         'system'),
  -- RBAC
  ('rbac:read',      'Read RBAC',               'View roles and permissions',          'rbac'),
  ('rbac:write',     'Manage RBAC',             'Create, update, delete roles',        'rbac'),
  -- Catalog
  ('catalog:read',   'Read Catalog',            'View products, categories, brands',   'catalog'),
  ('catalog:write',  'Manage Catalog',          'Create, update, delete catalog',      'catalog'),
  ('catalog:approve','Approve Catalog',         'Approve catalog changes',             'catalog'),
  -- Inventory
  ('inventory:read',    'Read Inventory',     'View stock levels',                   'inventory'),
  ('inventory:write',   'Manage Inventory',   'Adjust stock levels',                 'inventory'),
  ('inventory:approve', 'Approve Inventory',  'Approve inventory adjustments',       'inventory'),
  -- Orders
  ('order:read',    'Read Orders',    'View orders',           'orders'),
  ('order:write',   'Manage Orders',  'Update orders',         'orders'),
  ('order:approve', 'Approve Orders', 'Approve orders',        'orders'),
  ('order:delete',  'Delete Orders',  'Cancel/delete orders',  'orders'),
  -- Shipping
  ('shipping:read',    'Read Shipping',   'View shipping zones and rates', 'shipping'),
  ('shipping:write',   'Manage Shipping', 'Update shipping zones and rates','shipping'),
  -- Logistics
  ('logistics:read',    'Read Logistics',   'View fulfillment and rider data',     'logistics'),
  ('logistics:write',   'Manage Logistics', 'Manage riders and fulfillment',       'logistics'),
  ('logistics:approve', 'Approve Logistics','Approve logistics changes',           'logistics'),
  -- Marketing
  ('marketing:read',    'Read Marketing',   'View promotions and campaigns',       'marketing'),
  ('marketing:write',   'Manage Marketing', 'Create and update promotions',        'marketing'),
  ('marketing:approve', 'Approve Marketing','Approve marketing campaigns',         'marketing'),
  -- CRM
  ('crm:read',    'Read CRM',    'View customer data and segments', 'crm'),
  ('crm:write',   'Manage CRM',  'Update customer data and segments','crm'),
  ('crm:approve', 'Approve CRM', 'Approve CRM modifications',        'crm'),
  -- Finance
  ('finance:read',    'Read Finance',    'View financial reports',     'finance'),
  ('finance:write',   'Manage Finance',  'Update financial settings',  'finance'),
  ('finance:approve', 'Approve Finance', 'Approve financial changes',  'finance'),
  -- Analytics
  ('analytics:read',  'Read Analytics',  'View analytics dashboards',  'analytics'),
  ('analytics:write', 'Manage Analytics','Update analytics settings',  'analytics'),
  -- Audit
  ('audit:read',   'Read Audit Logs',   'View audit logs',           'audit'),
  ('audit:write',  'Manage Audit',      'Update audit settings',     'audit')
ON CONFLICT (key) DO NOTHING;

-- ─── 3. Permission assignments for new roles ────────────────────────────────

-- 3a. SUPER_ADMIN — all permissions (including wildcard)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   roles r, permissions p
WHERE  r.name = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;

-- 3b. CATALOG_MANAGER — products, categories, brands, inventory read
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   roles r, permissions p
WHERE  r.name = 'CATALOG_MANAGER'
  AND  p.key IN (
    'catalog:read','catalog:write','catalog:approve',
    'category:manage','brand:manage',
    'product:read','product:write','product:create','product:delete',
    'inventory:read','inventory:alert',
    'settings:read','admin:access'
  )
ON CONFLICT DO NOTHING;

-- 3c. LOGISTICS_COORDINATOR — shipping, riders, fulfillment, orders
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   roles r, permissions p
WHERE  r.name = 'LOGISTICS_COORDINATOR'
  AND  p.key IN (
    'logistics:read','logistics:write','logistics:approve',
    'shipping:read','shipping:write',
    'order:read','order:write','order:fulfill',
    'customer:read',
    'settings:read','admin:access'
  )
ON CONFLICT DO NOTHING;

-- 3d. CUSTOMER_SUPPORT — tickets, reviews, onboarding, customer read
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   roles r, permissions p
WHERE  r.name = 'CUSTOMER_SUPPORT'
  AND  p.key IN (
    'crm:read','crm:write',
    'order:read',
    'customer:read',
    'review:read','review:write',
    'onboarding:manage',
    'settings:read','admin:access'
  )
ON CONFLICT DO NOTHING;

-- 3e. FINANCE_AUDITOR — read-only finance + audit + analytics
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   roles r, permissions p
WHERE  r.name = 'FINANCE_AUDITOR'
  AND  p.key IN (
    'finance:read',
    'audit:read',
    'analytics:read','sales:read',
    'order:read',
    'settings:read','admin:access'
  )
ON CONFLICT DO NOTHING;

-- 3f. MARKETING_SPECIALIST — promotions, coupons, campaigns
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   roles r, permissions p
WHERE  r.name = 'MARKETING_SPECIALIST'
  AND  p.key IN (
    'marketing:read','marketing:write','marketing:approve',
    'coupon:read','coupon:create','coupon:write','coupon:delete',
    'analytics:read',
    'settings:read','admin:access'
  )
ON CONFLICT DO NOTHING;

-- ─── 4. Verify counts ───────────────────────────────────────────────────────
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM roles
  WHERE name IN ('SUPER_ADMIN','CATALOG_MANAGER','LOGISTICS_COORDINATOR','CUSTOMER_SUPPORT','FINANCE_AUDITOR','MARKETING_SPECIALIST');
  RAISE NOTICE 'Target roles present: % / 6 expected', v_count;
END;
$$;
