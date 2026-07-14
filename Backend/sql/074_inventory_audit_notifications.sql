-- 074: Inventory audit fidelity + management notification wiring.
-- Supports the "Inventory Manager adjustment → Store Manager + Store Owner" real-time
-- notification flow and high-fidelity, queryable audit logging.

-- ── 1. Structured, queryable audit columns ────────────────────────────────────
-- JSONB old/new/delta/summary is not indexable; these typed columns power
-- filtering, export, and the Plain-English summary rendering.
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS resource_sku TEXT,
  ADD COLUMN IF NOT EXISTS resource_name TEXT,
  ADD COLUMN IF NOT EXISTS resource_category TEXT,
  ADD COLUMN IF NOT EXISTS context_location TEXT,        -- warehouse / aisle / bin
  ADD COLUMN IF NOT EXISTS context_batch_lot TEXT,       -- batch / lot number
  ADD COLUMN IF NOT EXISTS delta_numeric INT,            -- exact signed numeric difference
  ADD COLUMN IF NOT EXISTS reason_code TEXT,             -- 'return' | 'damaged' | ...
  ADD COLUMN IF NOT EXISTS device_info JSONB,            -- { ip, userAgent, sessionId, requestId }
  ADD COLUMN IF NOT EXISTS record_hash TEXT,             -- tamper-evidence hash chain
  ADD COLUMN IF NOT EXISTS prev_record_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_resource_sku   ON audit_logs(resource_sku);
CREATE INDEX IF NOT EXISTS idx_audit_resource_name  ON audit_logs(resource_name);
CREATE INDEX IF NOT EXISTS idx_audit_resource_cat   ON audit_logs(resource_category);
CREATE INDEX IF NOT EXISTS idx_audit_reason         ON audit_logs(reason_code);
CREATE INDEX IF NOT EXISTS idx_audit_delta          ON audit_logs(delta_numeric);
CREATE INDEX IF NOT EXISTS idx_audit_record_hash    ON audit_logs(record_hash);

-- ── 2. Contextual capture on the transaction itself ──────────────────────────
ALTER TABLE inventory_transactions
  ADD COLUMN IF NOT EXISTS warehouse_location TEXT,
  ADD COLUMN IF NOT EXISTS batch_lot TEXT,
  ADD COLUMN IF NOT EXISTS reason_code TEXT,             -- explicit, distinct from 'type'
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inv_txn_warehouse ON inventory_transactions(warehouse_location);
CREATE INDEX IF NOT EXISTS idx_inv_txn_batch    ON inventory_transactions(batch_lot);
CREATE INDEX IF NOT EXISTS idx_inv_txn_reason   ON inventory_transactions(reason_code);

-- ── 3. Routing rule: inventory adjustment → Store Manager + Store Owner ───────
INSERT INTO notification_routing_rules
  (name, event_key, recipient_roles, channel, severity, template_key)
VALUES
  ('Inventory adjustment → Manager + Owner', 'inventory.adjustment',
   '{MANAGER,STORE_OWNER}', '{inapp}', 'info', NULL)
ON CONFLICT (event_key) DO NOTHING;

-- ── 4. Immutability: append-only trigger (forbid UPDATE / DELETE) ────────────
-- RLS is disabled and the backend uses the service-role key (bypasses RLS), so
-- a DB-level trigger is the reliable guard against tampering with audit rows.
CREATE OR REPLACE FUNCTION forbid_audit_mutate() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only; modifications are not permitted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_no_update ON audit_logs;
CREATE TRIGGER trg_audit_no_update
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION forbid_audit_mutate();
