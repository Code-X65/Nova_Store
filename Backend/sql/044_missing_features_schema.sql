-- 1. Create Tax Rules Table
CREATE TABLE IF NOT EXISTS tax_rules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  country VARCHAR(100) NOT NULL,
  state VARCHAR(100),
  rate DECIMAL(6,4) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for tax rules queries
CREATE INDEX IF NOT EXISTS idx_tax_rules_country_state ON tax_rules(country, state);

-- Disable RLS on tax_rules
ALTER TABLE tax_rules DISABLE ROW LEVEL SECURITY;

-- 2. Create Currencies Table
CREATE TABLE IF NOT EXISTS currencies (
  code VARCHAR(3) PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL,
  rate_to_base DECIMAL(18,6) NOT NULL DEFAULT 1.000000,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable RLS on currencies
ALTER TABLE currencies DISABLE ROW LEVEL SECURITY;

-- 3. Create Full-Text Search GIN Index on Products
CREATE INDEX IF NOT EXISTS idx_products_fts ON products USING gin(to_tsvector('english', name || ' ' || description));

-- 4. Seed Default Tax Rules
INSERT INTO tax_rules (country, state, rate) VALUES
('US', 'CA', 0.0825),
('US', 'NY', 0.0888),
('NG', NULL, 0.0750)
ON CONFLICT DO NOTHING;

-- 5. Seed Default Currencies
INSERT INTO currencies (code, symbol, rate_to_base) VALUES
('NGN', '₦', 1.000000),
('USD', '$', 0.000670),
('GBP', '£', 0.000520),
('EUR', '€', 0.000610)
ON CONFLICT (code) DO UPDATE SET
  symbol = EXCLUDED.symbol,
  rate_to_base = EXCLUDED.rate_to_base;

-- 6. Create Full-Text Search RPC Function
CREATE OR REPLACE FUNCTION search_products(search_query TEXT, lim INT DEFAULT 10)
RETURNS SETOF products AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM products
  WHERE to_tsvector('english', name || ' ' || description) @@ websearch_to_tsquery('english', search_query)
     AND deleted_at IS NULL
  ORDER BY ts_rank(to_tsvector('english', name || ' ' || description), websearch_to_tsquery('english', search_query)) DESC
  LIMIT lim;
END;
$$ LANGUAGE plpgsql;
