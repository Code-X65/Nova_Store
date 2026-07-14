-- ============================================================
-- 084: Refunds & Dispute Management (Phase 4 §5.3)
-- ============================================================
-- Separates refund records from the inline return flow and adds a
-- dispute workflow with SLA timers. Refunds require finance:approve
-- before the gateway call; disputes track buyer↔store issues with
-- SLAs. Single-vendor: disputes are between customer and the store.
-- ============================================================

CREATE TABLE IF NOT EXISTS refunds (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  store_id          UUID REFERENCES stores(id) ON DELETE SET NULL,
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount            NUMERIC(12,2) NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'NGN',
  reason            TEXT,
  method            TEXT NOT NULL DEFAULT 'original_payment'
                      CHECK (method IN ('original_payment','bank_transfer','wallet','store_credit')),
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','processing','completed','failed','cancelled')),
  requested_by      UUID REFERENCES users(id),
  approved_by       UUID REFERENCES users(id),
  approved_at       TIMESTAMP WITH TIME ZONE,
  gateway_reference TEXT,
  processed_at      TIMESTAMP WITH TIME ZONE,
  notes             TEXT,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status   ON refunds(status);

ALTER TABLE refunds DISABLE ROW LEVEL SECURITY;

-- Disputes (SLA-tracked)
CREATE TABLE IF NOT EXISTS disputes (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  store_id          UUID REFERENCES stores(id) ON DELETE SET NULL,
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  opened_by         UUID REFERENCES users(id),
  subject           TEXT NOT NULL,
  description       TEXT,
  status            TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','investigating','awaiting_evidence','resolved','escalated','closed')),
  priority          TEXT NOT NULL DEFAULT 'medium'
                      CHECK (priority IN ('low','medium','high','urgent')),
  resolution        TEXT,
  resolution_notes  TEXT,
  assigned_to       UUID REFERENCES users(id),
  sla_due_at        TIMESTAMP WITH TIME ZONE,
  resolved_at       TIMESTAMP WITH TIME ZONE,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disputes_order_id ON disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status   ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_sla      ON disputes(sla_due_at);

ALTER TABLE disputes DISABLE ROW LEVEL SECURITY;

-- SLA defaults: disputes must be acknowledged/investigated within 72h.
CREATE OR REPLACE FUNCTION set_dispute_sla()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.sla_due_at IS NULL THEN
    NEW.sla_due_at := NOW() + INTERVAL '72 hours';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispute_sla ON disputes;
CREATE TRIGGER trg_dispute_sla
  BEFORE INSERT ON disputes
  FOR EACH ROW EXECUTE FUNCTION set_dispute_sla();

-- View: disputes currently breaching their SLA (not yet resolved/closed)
CREATE OR REPLACE VIEW disputes_breaching_sla AS
  SELECT *
  FROM disputes
  WHERE sla_due_at < NOW()
    AND status NOT IN ('resolved','closed','escalated');
