-- 038_add_oauth_providers.sql
-- Add facebook_id and apple_id columns to the users table and index them for quick lookups

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS facebook_id TEXT UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS apple_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_facebook_id ON public.users(facebook_id);
CREATE INDEX IF NOT EXISTS idx_users_apple_id ON public.users(apple_id);
