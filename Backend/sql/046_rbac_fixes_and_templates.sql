-- ============================================================
-- Migration 046: RBAC Gaps Fixes and Notification Templates
-- ============================================================

-- 1. Add extra_permissions to users table (granular permission overrides)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS extra_permissions JSONB DEFAULT '[]'::jsonb;

-- 2. Add accepted_by referencing users(id) to invitations table
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS accepted_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 3. Update admin_auth_logs.admin_id to reference users(id) instead of deprecated admins
ALTER TABLE public.admin_auth_logs DROP CONSTRAINT IF EXISTS admin_auth_logs_admin_id_fkey;
UPDATE public.admin_auth_logs SET admin_id = NULL WHERE admin_id NOT IN (SELECT id FROM public.users);
ALTER TABLE public.admin_auth_logs ADD CONSTRAINT admin_auth_logs_admin_id_fkey 
  FOREIGN KEY (admin_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- 4. Seed the three new notification templates for admin invitations
INSERT INTO public.notification_templates (key, name, subject, text_template, variables, channel) 
VALUES
  (
    'admin_invitation',
    'Admin Invitation',
    'You have been invited as an Administrator on {{storeName}}',
    'Hello, you have been invited to become an administrator on {{storeName}} by {{inviterName}}. Click here to accept the invitation and set your password: {{inviteLink}}. This invitation expires on {{expiryDate}}.',
    '["inviteLink","inviterName","expiryDate","storeName"]',
    '{email}'
  ),
  (
    'admin_invitation_accepted',
    'Admin Invitation Accepted',
    'Invitation accepted — {{newAdminName}}',
    'Hi, the administrator invitation sent to {{newAdminEmail}} has been accepted by {{newAdminName}}.',
    '["newAdminName","newAdminEmail","storeName"]',
    '{email}'
  ),
  (
    'admin_invitation_revoked',
    'Admin Invitation Revoked',
    'Administrator invitation revoked',
    'Your invitation to join {{storeName}} as an administrator has been revoked by the system administrator.',
    '["storeName"]',
    '{email}'
  )
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  subject = EXCLUDED.subject,
  text_template = EXCLUDED.text_template,
  variables = EXCLUDED.variables,
  channel = EXCLUDED.channel;
