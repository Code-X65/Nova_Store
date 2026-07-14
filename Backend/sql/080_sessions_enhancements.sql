-- 080_sessions_enhancements.sql
-- Add device fingerprinting and connection metadata to the sessions table
-- so the admin session-management UI can show per-session device info.

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS device_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS ip_address INET;

CREATE INDEX IF NOT EXISTS idx_sessions_device_fingerprint ON sessions(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_sessions_user_agent ON sessions(user_agent);
