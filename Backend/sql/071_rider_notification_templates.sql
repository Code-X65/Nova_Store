-- ============================================================
-- 071: Rider Notification Templates
-- ============================================================
-- Seeds notification templates used when a rider is approved
-- or rejected by the store owner.
-- ============================================================

INSERT INTO notification_templates (key, name, subject, text_template, channel)
VALUES
  (
    'rider_approved',
    'Rider Enrollment Approved',
    'Rider Enrollment Approved — {{firstName}} {{lastName}}',
    'Rider {{firstName}} {{lastName}} has been approved and is now live.',
    '{inapp,email}'
  ),
  (
    'rider_rejected',
    'Rider Enrollment Rejected',
    'Rider Enrollment Rejected — {{firstName}} {{lastName}}',
    'Rider {{firstName}} {{lastName}} was rejected. Reason: {{reason}}',
    '{inapp,email}'
  )
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM notification_templates
   WHERE key IN ('rider_approved', 'rider_rejected');
  RAISE NOTICE 'Rider notification templates seeded: %', v_count;
END;
$$;
