-- ============================================================
-- 088: Permission catalog for Phase 4 & 5
-- ============================================================
-- New permission keys for billing, disputes, returns and 3PL
-- fulfillment. finance:* / logistics:* already seeded in 081.
-- ============================================================

INSERT INTO permissions (key, name, description, category)
VALUES
  ('billing:read',     'Read Billing & Invoices', 'View invoices and billing records',      'finance'),
  ('disputes:read',    'Read Disputes',           'View customer/store disputes',           'finance'),
  ('disputes:resolve', 'Resolve Disputes',        'Investigate and resolve disputes',       'finance'),
  ('returns:read',     'Read Returns',            'View RMA / return records',              'orders'),
  ('returns:write',    'Manage Returns',          'Approve, schedule and complete returns', 'orders'),
  ('fulfillment:read', 'Read Fulfillment',        'View 3PL providers and shipments',       'logistics'),
  ('fulfillment:write','Manage Fulfillment',      'Configure providers and create shipments','logistics')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

-- ── Role assignments ──────────────────────────────────────────────────────────
DO $$
DECLARE v_role_id UUID; BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = 'MANAGER';
  IF v_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, p.id FROM permissions p
    WHERE p.key IN ('billing:read','disputes:read','disputes:resolve','returns:read','returns:write',
                    'fulfillment:read','fulfillment:write','finance:read','finance:write','finance:approve')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

DO $$
DECLARE v_role_id UUID; BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = 'FINANCE_AUDITOR';
  IF v_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, p.id FROM permissions p
    WHERE p.key IN ('billing:read','disputes:read','finance:read','order:read')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

DO $$
DECLARE v_role_id UUID; BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = 'LOGISTICS_COORDINATOR';
  IF v_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, p.id FROM permissions p
    WHERE p.key IN ('fulfillment:read','fulfillment:write','returns:read','returns:write',
                    'disputes:read','logistics:read','logistics:write','logistics:approve','order:read','order:write')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

DO $$
DECLARE v_role_id UUID; BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = 'CUSTOMER_SUPPORT';
  IF v_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, p.id FROM permissions p
    WHERE p.key IN ('disputes:read','disputes:resolve','returns:read','order:read','finance:read','finance:write')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

DO $$
DECLARE v_role_id UUID; BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = 'CATALOG_MANAGER';
  IF v_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, p.id FROM permissions p
    WHERE p.key IN ('returns:read')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

DO $$
DECLARE v_role_id UUID; BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = 'ORDER_STAFF';
  IF v_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, p.id FROM permissions p
    WHERE p.key IN ('returns:read','disputes:read')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

DO $$
DECLARE v_role_id UUID; BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = 'INVENTORY_STAFF';
  IF v_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, p.id FROM permissions p
    WHERE p.key IN ('returns:read')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
