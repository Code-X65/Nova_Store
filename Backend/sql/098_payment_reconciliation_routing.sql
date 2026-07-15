-- Route the new payment.reconciliation_required event (fired when a gateway
-- webhook confirms payment for an order that's already cancelled/refunded/
-- returned) to Owners + Managers for manual review.

INSERT INTO notification_routing_rules (name, event_key, recipient_roles, channel, severity, template_key)
VALUES
  ('Payment on closed order → Owners', 'payment.reconciliation_required', '{STORE_OWNER,MANAGER}', '{inapp,email}', 'critical', NULL)
ON CONFLICT (event_key) DO NOTHING;
