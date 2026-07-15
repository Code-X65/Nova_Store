-- refund.service.js (the standalone `refunds` table system, distinct from
-- order.service.js's return flow) never notified anyone when a refund was
-- requested, completed, or failed. Add a customer-facing "refund completed"
-- template and staff-facing routing rules for the request/completion/failure
-- events so finance/ops actually see refund activity instead of it being
-- fully silent.

INSERT INTO notification_templates (key, name, subject, text_template, variables, channel)
VALUES (
  'refund_completed',
  'Refund Completed',
  'Your refund for order {{orderNumber}} has been processed',
  'Hi {{userName}}, a refund of {{refundAmount}} for order {{orderNumber}} has been processed to your original payment method. Please allow 5-10 business days for it to appear.',
  '["userName","orderNumber","refundAmount"]',
  '{email,inapp}'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO notification_routing_rules (name, event_key, recipient_roles, channel, severity, template_key)
VALUES
  ('Refund requested → Owners',  'refund.requested', '{STORE_OWNER,MANAGER}', '{inapp}',       'info',     NULL),
  ('Refund completed → Owners',  'refund.completed', '{STORE_OWNER,MANAGER}', '{inapp}',       'info',     NULL),
  ('Refund failed → Owners',     'refund.failed',    '{STORE_OWNER,MANAGER}', '{inapp,email}', 'critical', NULL)
ON CONFLICT (event_key) DO NOTHING;
