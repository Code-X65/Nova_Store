-- Refunds & returns columns for the orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS refund_amount      DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_reason       TEXT,
  ADD COLUMN IF NOT EXISTS refund_status       TEXT CHECK (refund_status IN ('pending', 'approved', 'rejected', 'completed', 'failed')) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS returned_at         TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS refunded_at         TIMESTAMP WITH TIME ZONE;
