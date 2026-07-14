-- ============================================================
-- 068b: Order Lifecycle Hardening
-- ============================================================
-- Adds the 'completed' terminal state to the order lifecycle,
-- extending the status constraint and adding a completed_at
-- milestone timestamp.
-- ============================================================

-- Add completed_at milestone column if missing
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Widen the order status check constraint to include 'completed'
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending','confirmed','processing',
    'ready_for_dispatch','dispatched','out_for_delivery',
    'delivery_attempted','delivered','completed',
    'cancelled','returned','refunded'
  ));
