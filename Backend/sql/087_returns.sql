-- ============================================================
-- 087: Reverse Logistics — Returns (RMA) (Phase 5 §7.3)
-- ============================================================
-- Dedicated RMA (Return Merchandise Authorisation) lifecycle with
-- return label generation and restock-on-receipt. Distinct from the
-- legacy inline order.return_status flow; this becomes the primary
-- reverse-logistics engine for the admin portal.
-- ============================================================

CREATE TABLE IF NOT EXISTS returns (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  store_id          UUID REFERENCES stores(id) ON DELETE SET NULL,
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  rma_number        TEXT NOT NULL UNIQUE,
  status            TEXT NOT NULL DEFAULT 'requested'
                        CHECK (status IN (
                          'requested','approved','pickup_scheduled','collected',
                          'qc_received','refund_pending','completed','rejected'
                        )),
  reason            TEXT,
  condition         TEXT CHECK (condition IN ('sellable','damaged','quarantine','discard')),
  return_method     TEXT NOT NULL DEFAULT 'pickup'
                        CHECK (return_method IN ('pickup','dropoff')),
  refund_amount     NUMERIC(12,2) DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'NGN',
  tracking_number   TEXT,
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_returns_order_id  ON returns(order_id);
CREATE INDEX IF NOT EXISTS idx_returns_status    ON returns(status);
CREATE INDEX IF NOT EXISTS idx_returns_rma       ON returns(rma_number);

ALTER TABLE returns DISABLE ROW LEVEL SECURITY;

-- Generated return labels / shipping documents
CREATE TABLE IF NOT EXISTS return_labels (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  return_id         UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  carrier           TEXT,
  label_url         TEXT,
  tracking_number   TEXT,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_return_labels_return ON return_labels(return_id);

ALTER TABLE return_labels DISABLE ROW LEVEL SECURITY;

-- RMA transition table (mirrors order_status_transitions pattern)
CREATE TABLE IF NOT EXISTS return_status_transitions (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  from_status TEXT NOT NULL,
  to_status   TEXT NOT NULL,
  requires_note BOOLEAN DEFAULT FALSE,
  UNIQUE (from_status, to_status)
);

ALTER TABLE return_status_transitions DISABLE ROW LEVEL SECURITY;

INSERT INTO return_status_transitions (from_status, to_status, requires_note)
VALUES
  ('requested',        'under_review',     false),
  ('requested',        'approved',         false),
  ('requested',        'rejected',         true),
  ('under_review',     'approved',         false),
  ('under_review',     'rejected',         true),
  ('approved',         'pickup_scheduled', false),
  ('approved',         'rejected',         true),
  ('pickup_scheduled', 'collected',        false),
  ('collected',        'qc_received',      false),
  ('qc_received',      'refund_pending',   false),
  ('refund_pending',   'completed',        false),
  ('qc_received',      'completed',        false)
ON CONFLICT (from_status, to_status) DO UPDATE SET
  requires_note = EXCLUDED.requires_note;
