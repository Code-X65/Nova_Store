-- ============================================================
-- 069: Payment Configuration Seed
-- ============================================================
-- Seeds the Pay on Delivery (POD) business-rule toggle into
-- the global settings table. Store-level fallback can be added
-- via the existing store_settings JSONB mechanism.
-- ============================================================

INSERT INTO settings (key, value, value_type, description, group_name, is_public)
VALUES
  ('payment.pay_on_delivery_enabled', 'false', 'boolean', 'Enable Pay on Delivery as a payment option at checkout and dispatch', 'payments', false)
ON CONFLICT (key) DO NOTHING;
