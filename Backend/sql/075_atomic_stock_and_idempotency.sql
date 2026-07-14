-- 075: Atomic, race-free stock mutation + realtime idempotency.
-- Implements Phase 0 of the realtime communication strategy: eliminates the
-- read-then-write (TOCTOU) race in updateStock, adds entity versioning for
-- client-side reconciliation, and makes notification delivery idempotent so a
-- Redis Pub/Sub fan-out replay cannot create duplicate rows.

-- 1. Optimistic-concurrency version on products (incremented atomically).
ALTER TABLE products ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_products_version ON products (version);

-- 2. Idempotency key on notifications (dedupes cross-instance fan-out).
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS event_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_idempotency
  ON notifications (user_id, event_id, type)
  WHERE event_id IS NOT NULL;

-- 3. Atomic stock delta (no read-then-write in the app). Returns new state.
-- Returns 0 rows (not an error) when the delta would drop stock below zero,
-- so the caller can map it to INSUFFICIENT_STOCK.
CREATE OR REPLACE FUNCTION apply_stock_delta(p_product_id UUID, p_delta INT)
RETURNS TABLE (out_id UUID, out_stock INT, out_version BIGINT, out_status TEXT) AS $$
BEGIN
  RETURN QUERY
  UPDATE products
     SET stock_quantity = stock_quantity + p_delta,
         version        = version + 1,
         status         = CASE WHEN stock_quantity + p_delta <= 0 THEN 'out_of_stock' ELSE 'published' END,
         updated_at     = now()
   WHERE id = p_product_id
     AND stock_quantity + p_delta >= 0
  RETURNING products.id, products.stock_quantity, products.version, products.status;
END;
$$ LANGUAGE plpgsql;

-- 4. Atomic variant stock delta (same guard).
CREATE OR REPLACE FUNCTION apply_variant_stock_delta(p_variant_id UUID, p_delta INT)
RETURNS TABLE (out_id UUID, out_stock INT) AS $$
BEGIN
  RETURN QUERY
  UPDATE product_variants
     SET stock_quantity = stock_quantity + p_delta
   WHERE id = p_variant_id
     AND stock_quantity + p_delta >= 0
  RETURNING product_variants.id, product_variants.stock_quantity;
END;
$$ LANGUAGE plpgsql;
