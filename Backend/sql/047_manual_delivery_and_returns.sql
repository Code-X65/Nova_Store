-- ============================================================
-- 047: Manual Delivery & Returns Framework
-- ============================================================
-- Extends orders with delivery milestone fields, adds a
-- delivery_dispatches table for driver assignment records,
-- enriches return columns, and seeds notification templates
-- for all milestone events.
-- ============================================================

-- ── 1. Extend orders table ────────────────────────────────────────────────────

-- Operational driver-facing delivery state (separate from customer-visible status)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_status TEXT
    CHECK (delivery_status IN (
      'not_dispatched','assigned','picked_up',
      'out_for_delivery','attempted','rescheduled',
      'delivered','returned_to_store'
    )),
  ADD COLUMN IF NOT EXISTS driver_name              TEXT,
  ADD COLUMN IF NOT EXISTS driver_phone             TEXT,
  ADD COLUMN IF NOT EXISTS dispatched_at            TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS out_for_delivery_at      TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS attempted_at             TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS manual_dispatch_notes    TEXT,
  ADD COLUMN IF NOT EXISTS delivery_window          TEXT,
  -- Return window: delivered_at + 7 days; set automatically when order is delivered
  ADD COLUMN IF NOT EXISTS return_window_expires_at TIMESTAMP WITH TIME ZONE,
  -- Return evidence
  ADD COLUMN IF NOT EXISTS return_evidence_urls     TEXT[],
  ADD COLUMN IF NOT EXISTS return_evidence_notes    TEXT,
  -- QC
  ADD COLUMN IF NOT EXISTS return_collected_at      TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS qc_outcome               TEXT CHECK (qc_outcome IN ('sellable','damaged','quarantine','discard')),
  ADD COLUMN IF NOT EXISTS qc_notes                 TEXT;

-- Widen the order status check constraint to cover all manual delivery milestones
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending','confirmed','processing',
    'ready_for_dispatch','dispatched','out_for_delivery',
    'delivery_attempted','delivered',
    'cancelled','returned','refunded'
  ));

-- Widen the return_status check constraint to cover full reverse-logistics lifecycle
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_return_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_return_status_check
  CHECK (return_status IN (
    'requested','under_review','approved','rejected',
    'pickup_scheduled','collected','qc_received',
    'refund_pending','refund_completed','completed'
  ));

-- ── 2. Create delivery_dispatches table ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS delivery_dispatches (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  assigned_by     UUID REFERENCES users(id),

  driver_name     TEXT NOT NULL,
  driver_phone    TEXT,
  dispatch_notes  TEXT,

  -- Proof of delivery
  pod_type        TEXT CHECK (pod_type IN ('otp','signature','photo_reference','driver_confirmation')),
  pod_value       TEXT,

  status          TEXT NOT NULL DEFAULT 'assigned'
    CHECK (status IN (
      'assigned','picked_up','out_for_delivery',
      'attempted','rescheduled','delivered','returned_to_store'
    )),

  dispatched_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  picked_up_at    TIMESTAMP WITH TIME ZONE,
  delivered_at    TIMESTAMP WITH TIME ZONE,
  failed_at       TIMESTAMP WITH TIME ZONE,

  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_dispatches_order_id  ON delivery_dispatches(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_dispatches_status    ON delivery_dispatches(status);

ALTER TABLE delivery_dispatches DISABLE ROW LEVEL SECURITY;

-- ── 3. Seed new notification templates ───────────────────────────────────────

INSERT INTO notification_templates (key, name, subject, text_template, variables, channel) VALUES
  (
    'order_processing',
    'Order Processing',
    'We are preparing your order — {{orderNumber}}',
    'Hi {{userName}}, we are preparing your order {{orderNumber}}. You will be notified once it is ready for dispatch.',
    '["userName","orderNumber"]',
    '{email,inapp}'
  ),
  (
    'order_dispatched',
    'Order Dispatched',
    'Your order {{orderNumber}} has been assigned for delivery',
    'Hi {{userName}}, your order {{orderNumber}} has been assigned to a delivery driver and will be on its way soon.',
    '["userName","orderNumber"]',
    '{email,inapp}'
  ),
  (
    'order_out_for_delivery',
    'Order Out for Delivery',
    'Your order {{orderNumber}} is out for delivery today',
    'Hi {{userName}}, great news! Your order {{orderNumber}} is out for delivery today. Please ensure someone is available to receive it.',
    '["userName","orderNumber"]',
    '{email,inapp}'
  ),
  (
    'order_delivery_attempted',
    'Delivery Attempted',
    'We attempted delivery for order {{orderNumber}}',
    'Hi {{userName}}, we attempted to deliver your order {{orderNumber}} but were unable to complete it. Please contact us to reschedule your delivery.',
    '["userName","orderNumber"]',
    '{email,inapp}'
  ),
  (
    'return_under_review',
    'Return Under Review',
    'Your return request for {{orderNumber}} is under review',
    'Hi {{userName}}, we have received your return request for order {{orderNumber}} and it is currently under review. We will get back to you within 1 business day.',
    '["userName","orderNumber"]',
    '{email,inapp}'
  ),
  (
    'return_pickup_scheduled',
    'Return Pickup Scheduled',
    'Return pickup for order {{orderNumber}} is scheduled',
    'Hi {{userName}}, a driver has been assigned to collect your return for order {{orderNumber}}. Please have the item ready.',
    '["userName","orderNumber"]',
    '{email,inapp}'
  ),
  (
    'return_collected',
    'Return Item Collected',
    'Your returned item for order {{orderNumber}} has been collected',
    'Hi {{userName}}, our driver has collected the returned item for order {{orderNumber}}. We will inspect it and process your refund shortly.',
    '["userName","orderNumber"]',
    '{email,inapp}'
  ),
  (
    'return_refund_pending',
    'Refund Being Processed',
    'Your refund for order {{orderNumber}} is being processed',
    'Hi {{userName}}, your refund for order {{orderNumber}} has been approved and is currently being processed. You will be notified once it is completed.',
    '["userName","orderNumber"]',
    '{email,inapp}'
  ),
  (
    'return_refund_completed',
    'Refund Completed',
    'Your refund for order {{orderNumber}} has been completed',
    'Hi {{userName}}, your refund of {{refundAmount}} for order {{orderNumber}} has been successfully processed. Please allow 3–5 business days for it to reflect in your account.',
    '["userName","orderNumber","refundAmount"]',
    '{email,inapp}'
  )
ON CONFLICT (key) DO NOTHING;
