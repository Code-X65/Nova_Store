-- 063: Enrich audit_logs with severity, structured action type, actor details,
-- and a field-level delta/summary so the audit trail meets the compliance spec
-- (severity level, action type, actor identity/session, before/after delta).

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS event_id TEXT,
  ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'critical')),
  ADD COLUMN IF NOT EXISTS action_type TEXT
    CHECK (action_type IN ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'STATUS_CHANGE', 'OTHER')),
  ADD COLUMN IF NOT EXISTS actor_full_name TEXT,
  ADD COLUMN IF NOT EXISTS actor_role TEXT,
  ADD COLUMN IF NOT EXISTS actor_session_id TEXT,
  ADD COLUMN IF NOT EXISTS delta JSONB,
  ADD COLUMN IF NOT EXISTS summary TEXT;

-- De-duplication / idempotency key (nullable so legacy rows are unaffected).
CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_logs_event_id ON audit_logs (event_id)
  WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs (severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs (action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor_full_name);
