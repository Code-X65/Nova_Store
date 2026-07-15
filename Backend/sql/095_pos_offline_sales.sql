-- ============================================================
-- 095: POS / Offline Sales
-- ============================================================
-- Walk-in sales are just orders with channel='pos', created via
-- the existing create_order_with_items RPC (guest/manual orders
-- are already fully supported — user_id nullable, customer_email
-- required). payments.provider/reference have no CHECK constraint,
-- so provider='cash'|'pos_card'|'pos_transfer' needs no schema
-- change. New permissions: pos:read, pos:create.
-- ============================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'online' CHECK (channel IN ('online', 'pos'));

CREATE INDEX IF NOT EXISTS idx_orders_channel ON orders(channel);

INSERT INTO permissions (key, name, description, category)
VALUES
  ('pos:read',   'Read POS Sales',   'View point-of-sale / walk-in sales history', 'orders'),
  ('pos:create', 'Create POS Sales', 'Record a walk-in / offline sale',            'orders')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

DO $$
DECLARE v_role_id UUID; BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = 'SUPER_ADMIN';
  IF v_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, p.id FROM permissions p WHERE p.key IN ('pos:read','pos:create')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

DO $$
DECLARE v_role_id UUID; BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = 'CUSTOMER_SUPPORT';
  IF v_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, p.id FROM permissions p WHERE p.key IN ('pos:read','pos:create')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
