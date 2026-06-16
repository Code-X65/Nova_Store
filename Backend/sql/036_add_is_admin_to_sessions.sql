-- 036_add_is_admin_to_sessions.sql
-- Add is_admin column to sessions table to support concurrent admin session management

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for querying admin sessions
CREATE INDEX IF NOT EXISTS idx_sessions_is_admin ON public.sessions(is_admin);
