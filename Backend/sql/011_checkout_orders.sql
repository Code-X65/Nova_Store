-- Checkout & Coupons
CREATE TABLE IF NOT EXISTS coupons (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  type TEXT CHECK (type IN ('percentage', 'fixed')) NOT NULL,
  value DECIMAL(10,2) NOT NULL,
  min_order_amount DECIMAL(10,2),
  max_discount DECIMAL(10,2),
  starts_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  usage_limit INT,
  used_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_coupons (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders System
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id), -- Null for guest orders? Usually required
  order_number TEXT UNIQUE NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned')),
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'partially_paid', 'refunded', 'failed')),
  
  -- Totals
  subtotal DECIMAL(10,2) NOT NULL,
  shipping_cost DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  
  -- Coupon
  coupon_id UUID REFERENCES coupons(id),
  
  -- Shipping Details
  shipping_address JSONB NOT NULL,
  shipping_method TEXT,
  tracking_number TEXT,
  
  -- Contact Details
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  
  -- Metadata
  notes TEXT,
  checkout_session_id UUID, -- For linking with checkout
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  product_name TEXT NOT NULL, -- Snapshot at time of order
  sku TEXT NOT NULL,          -- Snapshot at time of order
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment Records
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'NGN',
  
  provider TEXT NOT NULL, -- 'paystack', 'flutterwave', 'stripe'
  reference TEXT UNIQUE NOT NULL, -- Provider reference
  status TEXT NOT NULL, -- 'pending', 'success', 'failed', 'reversed'
  
  payment_method TEXT, -- 'card', 'transfer', etc.
  raw_response JSONB, -- Store full response from provider
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference);

-- Disable RLS
ALTER TABLE coupons DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_coupons DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;

-- RPC: Increment Coupon Usage
CREATE OR REPLACE FUNCTION increment_coupon_usage(coupon_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE coupons
  SET used_count = used_count + 1
  WHERE id = coupon_id;
END;
$$ LANGUAGE plpgsql;

-- RPC: Create Order with Items (Atomic)
CREATE OR REPLACE FUNCTION create_order_with_items(
  p_order_data JSONB,
  p_order_items JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_order_id UUID;
  v_result JSONB;
BEGIN
  -- Insert Order
  INSERT INTO orders (
    user_id, order_number, subtotal, shipping_cost, tax_amount, 
    discount_amount, total_amount, coupon_id, shipping_address, 
    shipping_method, customer_email, customer_phone, notes, checkout_session_id
  )
  VALUES (
    (p_order_data->>'user_id')::UUID,
    p_order_data->>'order_number',
    (p_order_data->>'subtotal')::DECIMAL,
    (p_order_data->>'shipping_cost')::DECIMAL,
    (p_order_data->>'tax_amount')::DECIMAL,
    (p_order_data->>'discount_amount')::DECIMAL,
    (p_order_data->>'total_amount')::DECIMAL,
    (p_order_data->>'coupon_id')::UUID,
    (p_order_data->'shipping_address')::JSONB,
    p_order_data->>'shipping_method',
    p_order_data->>'customer_email',
    p_order_data->>'customer_phone',
    p_order_data->>'notes',
    (p_order_data->>'checkout_session_id')::UUID
  )
  RETURNING id INTO v_order_id;

  -- Insert Items
  INSERT INTO order_items (
    order_id, product_id, variant_id, product_name, sku, quantity, unit_price, total_price
  )
  SELECT 
    v_order_id,
    (item->>'product_id')::UUID,
    (item->>'variant_id')::UUID,
    item->>'product_name',
    item->>'sku',
    (item->>'quantity')::INT,
    (item->>'unit_price')::DECIMAL,
    (item->>'total_price')::DECIMAL
  FROM jsonb_array_elements(p_order_items) AS item;

  -- Return created order
  SELECT jsonb_build_object('id', v_order_id) INTO v_result;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;
