-- 072: Add missing notification routing rules and payment_success template.
-- This migration adds routing for events that have templates but no rules,
-- and seeds the payment_success notification template.

-- ─── Routing Rules ────────────────────────────────────────────────────────────

INSERT INTO notification_routing_rules (name, event_key, recipient_roles, channel, severity, template_key)
VALUES
  ('Order cancelled → Sales',      'order.cancelled',        '{ORDER_STAFF,MANAGER}',        '{inapp,email}', 'warning',  'order_cancelled'),
  ('Order delivered → Sales',      'order.delivered',        '{ORDER_STAFF}',                '{inapp}',       'info',     'order_delivered'),
  ('Rider approved → Owners',      'rider.approved',         '{STORE_OWNER,MANAGER}',        '{inapp}',       'info',     'rider_approved'),
  ('Rider rejected → Owners',      'rider.rejected',         '{STORE_OWNER,MANAGER}',        '{inapp}',       'warning',  'rider_rejected'),
  ('Return requested → Sales',     'order.returned',         '{ORDER_STAFF,MANAGER}',        '{inapp}',       'warning',  'return_requested'),
  ('Payment successful → Sales',   'order.payment_succeeded','{ORDER_STAFF,MANAGER}',        '{inapp,email}', 'info',     'payment_success')
ON CONFLICT (event_key) DO NOTHING;

-- ─── payment_success Template ─────────────────────────────────────────────────

INSERT INTO notification_templates (key, name, subject, text_template, html_template, channel, is_system, is_active, created_at, updated_at)
VALUES (
  'payment_success',
  'Payment Successful',
  'Payment confirmed for order #{{orderNumber}}',
  'Hi {{userName}}, your payment of {{totalAmount}} for order #{{orderNumber}} was successful.',
  '<p>Hi {{userName}},</p><p>Your payment of <strong>{{totalAmount}}</strong> for order #<strong>{{orderNumber}}</strong> was successful.</p>',
  '{email,inapp}',
  true,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO NOTHING;
