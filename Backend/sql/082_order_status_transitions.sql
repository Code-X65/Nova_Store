-- ============================================================
-- 082: Order Status State Machine (Phase 4 §5.1)
-- ============================================================
-- Replaces ad-hoc, code-only transition checks with an explicit,
-- server-enforced transition table. The order service queries this
-- table to validate every status change so illegal jumps
-- (e.g. shipping a cancelled order) are impossible.
-- ============================================================

CREATE TABLE IF NOT EXISTS order_status_transitions (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  from_status   TEXT NOT NULL,
  to_status     TEXT NOT NULL,
  requires_note BOOLEAN DEFAULT FALSE,
  is_terminal   BOOLEAN DEFAULT FALSE,
  description   TEXT,
  UNIQUE (from_status, to_status)
);

-- Index for fast lookup of allowed next states
CREATE INDEX IF NOT EXISTS idx_ost_from ON order_status_transitions(from_status);

ALTER TABLE order_status_transitions DISABLE ROW LEVEL SECURITY;

-- ── Seed the canonical lifecycle ───────────────────────────────────────────────
INSERT INTO order_status_transitions (from_status, to_status, requires_note, is_terminal, description)
VALUES
  -- Intake
  ('pending',   'confirmed',     false, false, 'Payment accepted / order confirmed'),
  ('pending',   'processing',    false, false, 'Move straight into processing'),
  ('pending',   'cancelled',     true,  true,  'Cancel before fulfilment'),
  ('confirmed', 'processing',    false, false, 'Begin fulfilment'),
  ('confirmed', 'ready_for_dispatch', false, false, 'Packed and ready'),
  ('confirmed', 'cancelled',     true,  true,  'Cancel before fulfilment'),
  -- Fulfilment
  ('processing','ready_for_dispatch', false, false, 'Packed and ready'),
  ('processing','cancelled',     true,  true,  'Cancel before dispatch'),
  ('ready_for_dispatch','dispatched', false, false, 'Driver assigned'),
  ('ready_for_dispatch','processing',  false, false, 'Re-queue for re-pack'),
  ('ready_for_dispatch','cancelled',   true,  true,  'Cancel before dispatch'),
  ('dispatched','out_for_delivery', false, false, 'Driver en route'),
  ('dispatched','delivery_attempted', false, false, 'Failed attempt'),
  ('dispatched','processing',  false, false, 'Returned to store, re-queue'),
  ('out_for_delivery','delivered', false, false, 'Delivered to customer'),
  ('out_for_delivery','delivery_attempted', false, false, 'Failed attempt'),
  ('out_for_delivery','processing', false, false, 'Returned to store, re-queue'),
  ('delivery_attempted','out_for_delivery', false, false, 'Retry delivery'),
  ('delivery_attempted','delivered', false, false, 'Delivered on retry'),
  ('delivery_attempted','processing', false, false, 'Returned to store, re-queue'),
  -- Completion / returns
  ('delivered','completed', false, true,  'Closed successfully (terminal)'),
  ('delivered','returned',  false, false, 'Customer return initiated'),
  ('returned', 'refunded',  false, true,  'Return fully processed (terminal)'),
  ('refunded', 'completed', false, true,  'Closed after refund (terminal)')
ON CONFLICT (from_status, to_status) DO UPDATE SET
  requires_note = EXCLUDED.requires_note,
  is_terminal   = EXCLUDED.is_terminal,
  description   = EXCLUDED.description;

-- Helper: list allowed next states for a given status (used by UI dropdowns)
CREATE OR REPLACE FUNCTION allowed_order_transitions(p_status TEXT)
RETURNS TABLE (to_status TEXT, requires_note BOOLEAN, is_terminal BOOLEAN) LANGUAGE sql STABLE AS $$
  SELECT t.to_status, t.requires_note, t.is_terminal
  FROM order_status_transitions t
  WHERE t.from_status = p_status
  ORDER BY t.to_status;
$$;
