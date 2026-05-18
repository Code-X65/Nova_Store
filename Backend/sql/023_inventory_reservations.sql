-- Inventory reservation columns & table (Item 9)

-- Add reserved_quantity to products so "available" == stock_quantity - reserved_quantity
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS reserved_quantity INT DEFAULT 0;

-- Inventory reservations table: tracks which checkout session holds how many units
CREATE TABLE IF NOT EXISTS inventory_reservations (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id        UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity          INT NOT NULL CHECK (quantity > 0),
  order_id          UUID REFERENCES orders(id) ON DELETE SET NULL,
  checkout_session_id TEXT NOT NULL,
  expires_at        TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservations_product ON inventory_reservations(product_id);
CREATE INDEX IF NOT EXISTS idx_reservations_expires ON inventory_reservations(expires_at);
CREATE INDEX IF NOT EXISTS idx_reservations_session ON inventory_reservations(checkout_session_id);

ALTER TABLE inventory_reservations DISABLE ROW LEVEL SECURITY;
