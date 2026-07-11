-- 064: Notification routing — let admin alerts target ROLES/TEAMS (Sales, Warehouse,
-- Owners) instead of individual users, plus severity tagging for UI styling.

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS recipient_role TEXT,
  ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'critical'));

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_role ON notifications (recipient_role)
  WHERE recipient_role IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_severity ON notifications (severity);

-- Role-Based Routing Engine configuration.
-- Maps a domain event_key to one or more recipient roles (teams) + channels.
CREATE TABLE IF NOT EXISTS notification_routing_rules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  event_key TEXT NOT NULL UNIQUE,
  recipient_roles TEXT[] NOT NULL DEFAULT '{}',
  channel TEXT[] NOT NULL DEFAULT '{inapp}',
  severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'critical')),
  template_key TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routing_rules_event ON notification_routing_rules (event_key);
CREATE INDEX IF NOT EXISTS idx_routing_rules_active ON notification_routing_rules (is_active);

-- Seed default routing rules (idempotent: ON CONFLICT event_key DO NOTHING).
INSERT INTO notification_routing_rules (name, event_key, recipient_roles, channel, severity, template_key)
VALUES
  ('New order → Sales Team',        'order.placed',            '{ORDER_STAFF,MANAGER}',        '{inapp,email}', 'info',     'order_created'),
  ('Payment failed → Sales Team',   'order.payment_failed',    '{ORDER_STAFF,MANAGER}',        '{inapp}',       'warning',  'payment_failed'),
  ('Out of stock while picking',    'order.picked_out_of_stock','{INVENTORY_STAFF,MANAGER}',    '{inapp}',       'critical', NULL),
  ('Order shipped → Teams',         'order.shipped',           '{ORDER_STAFF,INVENTORY_STAFF}', '{inapp}',      'info',     NULL),
  ('Low stock → Warehouse',         'inventory.low_stock',     '{INVENTORY_STAFF}',            '{inapp}',       'warning',  'low_stock_alert'),
  ('Out of stock → Warehouse',      'inventory.out_of_stock',  '{INVENTORY_STAFF,MANAGER}',    '{inapp}',       'critical', NULL),
  ('Stock discrepancy → Warehouse', 'inventory.discrepancy',   '{INVENTORY_STAFF,MANAGER}',    '{inapp}',       'warning',  NULL),
  ('Catalog deletion → Owners',     'catalog.product.deleted', '{MANAGER,STORE_OWNER}',        '{inapp}',       'critical', NULL),
  ('Bulk attribute change → Owners','catalog.attribute.bulk_changed', '{MANAGER,STORE_OWNER}', '{inapp}',      'critical', NULL),
  ('Low review rating → Support',   'review.created',          '{ORDER_STAFF,MANAGER}',        '{inapp}',       'critical', NULL),
  ('Permission change → Owners',    'staff.permission_changed','{STORE_OWNER}',                '{inapp}',       'critical', NULL),
  ('Role escalation → Owners',      'staff.role_escalated',    '{STORE_OWNER}',                '{inapp}',       'critical', NULL),
  ('New staff user → Owners',       'staff.user_created',      '{STORE_OWNER}',                '{inapp}',       'critical', NULL)
ON CONFLICT (event_key) DO NOTHING;
