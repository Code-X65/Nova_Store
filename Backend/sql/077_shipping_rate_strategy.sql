-- 077_shipping_rate_strategy.sql
-- Add rate_strategy JSONB to shipping_zones for NGN-based rate models

ALTER TABLE shipping_zones
  ADD COLUMN IF NOT EXISTS rate_strategy JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN shipping_zones.rate_strategy IS 'NGN rate model: flat, weight_based, price_threshold, or free_over_X. Example: {"type":"flat","amount":1500}';
