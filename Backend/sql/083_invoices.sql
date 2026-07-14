-- ============================================================
-- 083: Automated Invoicing (Phase 4 §5.2)
-- ============================================================
-- Stores generated invoices (gross NGN totals only — no tax lines
-- per the single-vendor / gross-pricing decision). Invoices are
-- auto-generated on order.delivered / order.payment_succeeded and
-- made available for download + listed in the admin billing view.
-- ============================================================

CREATE TABLE IF NOT EXISTS invoices (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE SET NULL,
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_number    TEXT NOT NULL,
  invoice_no      TEXT NOT NULL UNIQUE,
  -- Gross NGN amounts only (no tax computation in this platform)
  subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping_cost   NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'NGN',
  pdf_url         TEXT,
  issued_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_order_id    ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_no  ON invoices(invoice_no);
CREATE INDEX IF NOT EXISTS idx_invoices_store_id    ON invoices(store_id);

ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;

-- One invoice per order keeps the auto-generation idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_invoices_order ON invoices(order_id);
