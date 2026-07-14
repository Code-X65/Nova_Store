-- 023_catalog_audit_extensions.sql
-- Extends the audit schema for catalog-specific traceability and
-- high-fidelity data search without altering the existing column layout.

-- 1. Structured context fields
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS device_fingerprint TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_ip_address INET;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS change_category TEXT CHECK (change_category IN ('metadata','pricing','inventory','media','status','configuration','security'));

-- 2. GIN indexes for JSONB containment + full-text search
CREATE INDEX IF NOT EXISTS idx_audit_logs_delta_gin ON audit_logs USING GIN (delta);
CREATE INDEX IF NOT EXISTS idx_audit_logs_new_values_gin ON audit_logs USING GIN (new_values);
CREATE INDEX IF NOT EXISTS idx_audit_logs_old_values_gin ON audit_logs USING GIN (old_values);

-- 3. Partial index for catalog-only super-fast queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_catalog
  ON audit_logs (created_at DESC)
  WHERE resource_type IN ('product','category','brand','category_attribute','product_variant');

-- 4. tsvector for full-text search on summary + action
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;
CREATE INDEX IF NOT EXISTS idx_audit_logs_search_vector ON audit_logs USING GIN (search_vector);

-- Maintain search_vector automatically
CREATE OR REPLACE FUNCTION audit_logs_search_vector_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.summary,'')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.action,'')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_search_vector_trigger ON audit_logs;
CREATE TRIGGER audit_logs_search_vector_trigger
  BEFORE INSERT OR UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_search_vector_trigger();

-- 5. Backfill search_vector for existing rows
UPDATE audit_logs
SET search_vector =
  setweight(to_tsvector('english', COALESCE(summary,'')), 'A') ||
  setweight(to_tsvector('english', COALESCE(action,'')), 'B')
WHERE search_vector IS NULL;
