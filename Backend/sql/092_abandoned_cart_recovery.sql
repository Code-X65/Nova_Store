-- ============================================================
-- 092: Abandoned Cart Recovery
-- ============================================================
-- Tracks reminder emails sent for carts with no recent activity,
-- so a cron job can avoid duplicate sends and measure recovery.
-- Reuses the existing 'marketing:read'/'marketing:write' permission
-- keys (081_rbac_new_roles.sql) — no new permissions required.
-- ============================================================

CREATE TABLE IF NOT EXISTS cart_recovery_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id         UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reminder_stage  INTEGER NOT NULL DEFAULT 1,
  sent_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  recovered       BOOLEAN NOT NULL DEFAULT FALSE,
  recovered_at    TIMESTAMP WITH TIME ZONE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cart_recovery_log_cart_id ON cart_recovery_log(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_recovery_log_user_id ON cart_recovery_log(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_recovery_log_recovered ON cart_recovery_log(recovered);

ALTER TABLE cart_recovery_log DISABLE ROW LEVEL SECURITY;

-- Notification template for the reminder email
INSERT INTO notification_templates (key, name, subject, text_template, variables, channel)
VALUES (
  'abandoned_cart',
  'Abandoned Cart Reminder',
  'You left something in your cart!',
  'Hi {{userName}}, you still have {{itemCount}} item(s) worth {{cartTotal}} waiting in your cart. Come back and complete your order before they sell out.',
  '["userName","itemCount","cartTotal"]',
  '{email}'
)
ON CONFLICT (key) DO NOTHING;

-- Feature configuration
INSERT INTO settings (key, value, value_type, description, group_name, is_public)
VALUES
  ('cart_recovery.enabled', 'true', 'boolean', 'Send automated reminder emails for abandoned carts', 'marketing', false),
  ('cart_recovery.delay_hours', '24', 'number', 'Hours of cart inactivity before a reminder is sent', 'marketing', false)
ON CONFLICT (key) DO NOTHING;
