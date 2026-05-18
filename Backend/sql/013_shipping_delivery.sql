-- 1. Shipping Zones (geographic regions)
CREATE TABLE IF NOT EXISTS shipping_zones (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,                    -- e.g., "US Continental", "West Africa"
  countries TEXT[] NOT NULL,             -- Array of ISO country codes ['US', 'CA']
  states JSONB DEFAULT '[]',             -- Array of state codes per country or "*" for all
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Shipping Rates (costs per zone/method)
CREATE TABLE IF NOT EXISTS shipping_rates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  zone_id UUID NOT NULL REFERENCES shipping_zones(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- e.g., "Standard", "Express", "Overnight"
  min_weight DECIMAL(8,3) DEFAULT 0,     -- in kg
  max_weight DECIMAL(8,3),               -- NULL means no upper limit
  min_order_amount DECIMAL(10,2) DEFAULT 0, -- Free shipping above this
  rate DECIMAL(10,2) NOT NULL,           -- Shipping cost
  estimated_days_min INT,
  estimated_days_max INT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Delivery States (optional lookup for UI progress steps)
CREATE TABLE IF NOT EXISTS delivery_states (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,                    -- e.g., "Order Placed", "Processing"
  description TEXT,
  icon_url TEXT,
  sort_order INT NOT NULL,
  is_delivered BOOLEAN DEFAULT FALSE,
  is_cancelled BOOLEAN DEFAULT FALSE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shipping_rates_zone ON shipping_rates(zone_id);
CREATE INDEX IF NOT EXISTS idx_shipping_zones_active ON shipping_zones(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_shipping_rates_active ON shipping_rates(is_active) WHERE is_active = TRUE;
