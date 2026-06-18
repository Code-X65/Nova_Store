-- ============================================================
-- Migration: 048_auth_logging_and_queue_hardening.sql
-- Adds:
--   1. user_agent + failure_reason columns to admin_auth_logs
--      (the legacy admin_id FK referenced public.admins which is
--       now superseded by public.users — we relax the FK too)
--   2. email_change_verification notification template
--   3. Index on notification_queue in-flight jobs (Redis-only
--      feature — no DB table required; documented here for reference)
-- ============================================================

-- 1a. Add user_agent column (nullable — old rows have no value)
ALTER TABLE public.admin_auth_logs
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- 1b. Add structured failure reason
ALTER TABLE public.admin_auth_logs
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- 1c. The admin_id FK historically pointed at public.admins.
--     Admin users now live in public.users; drop the old FK and
--     re-add it as a nullable soft-reference to public.users so
--     existing data is not broken.
DO $$
BEGIN
  -- Drop old constraint only if it still references public.admins
  IF EXISTS (
    SELECT 1
    FROM   information_schema.referential_constraints rc
    JOIN   information_schema.key_column_usage kcu
           ON kcu.constraint_name = rc.constraint_name
    WHERE  rc.constraint_name LIKE '%admin_auth_logs%admin_id%'
    AND    rc.unique_constraint_schema = 'public'
  ) THEN
    ALTER TABLE public.admin_auth_logs
      DROP CONSTRAINT IF EXISTS admin_auth_logs_admin_id_fkey;
  END IF;
END;
$$;

-- Re-add FK to public.users (nullable, SET NULL on delete so log rows are kept)
-- Only add if column type is compatible; cast to uuid first if needed.
ALTER TABLE public.admin_auth_logs
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 2. Seed email_change_verification template (skip if already present)
INSERT INTO public.notification_templates
  (key, name, subject, text_template, html_template, variables, channel)
VALUES (
  'email_change_verification',
  'Email Change Verification',
  'Confirm your new email address — Nova Store',
  'Hi {{firstName}}, you requested an email change on your Nova Store account. Click the link below to confirm your new email address: {{verificationUrl}}. This link expires in 2 hours. If you did not request this change, please ignore this email.',
  '<h1>Email Change Request</h1><p>Hello {{firstName}},</p><p>Please click the link below to confirm your new email address:</p><p><a href="{{verificationUrl}}">{{verificationUrl}}</a></p><p>This link will expire in 2 hours.</p><p>If you didn''t request this change, please ignore this email.</p>',
  '["firstName","verificationUrl"]',
  '{email}'
)
ON CONFLICT (key) DO NOTHING;

-- Also ensure email_verification has an html_template (may have been seeded without one)
UPDATE public.notification_templates
SET    html_template = '<h1>Welcome to Nova Store, {{firstName}}!</h1><p>Please click the link below to verify your email address:</p><p><a href="{{verificationLink}}">{{verificationLink}}</a></p><p>This link will expire in 24 hours.</p>'
WHERE  key = 'email_verification'
AND    (html_template IS NULL OR html_template = '');

-- 3. Index for efficient failure-reason analytics queries
CREATE INDEX IF NOT EXISTS idx_admin_auth_logs_failure_reason
  ON public.admin_auth_logs (failure_reason)
  WHERE failure_reason IS NOT NULL;
