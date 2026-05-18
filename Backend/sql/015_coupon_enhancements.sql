-- 1. Additional columns for richer coupons
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS applicable_product_ids UUID[] DEFAULT '{}'; -- NULL = all products
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS applicable_category TEXT;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS per_customer_limit INT DEFAULT 1; -- NULL = unlimited per customer
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS stackable BOOLEAN DEFAULT FALSE; -- can combine with other coupons
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'; -- flexible: min_quantity, max_uses_per_order, etc.

-- 2. Indexes for faster lookup
CREATE INDEX IF NOT EXISTS idx_coupons_active_code ON coupons(code, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_coupons_dates ON coupons(expires_at, starts_at);
CREATE INDEX IF NOT EXISTS idx_user_coupons_user ON user_coupons(user_id);
CREATE INDEX IF NOT EXISTS idx_user_coupons_coupon ON user_coupons(coupon_id);

-- 3. Function to check coupon eligibility (could be called from service)
CREATE OR REPLACE FUNCTION is_coupon_valid_for_user(
  p_coupon_id UUID,
  p_user_id UUID,
  p_cart_total DECIMAL
) RETURNS BOOLEAN AS $$
DECLARE
  v_coupon coupons%ROWTYPE;
  v_user_usage_count INT;
BEGIN
  SELECT * INTO v_coupon FROM coupons WHERE id = p_coupon_id AND is_active = TRUE;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  -- Date checks
  IF v_coupon.starts_at IS NOT NULL AND v_coupon.starts_at > NOW() THEN RETURN FALSE; END IF;
  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < NOW() THEN RETURN FALSE; END IF;

  -- Usage limit
  IF v_coupon.usage_limit IS NOT NULL AND v_coupon.used_count >= v_coupon.usage_limit THEN
    RETURN FALSE;
  END IF;

  -- Per-customer limit
  IF v_coupon.per_customer_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_user_usage_count
    FROM user_coupons
    WHERE user_id = p_user_id AND coupon_id = p_coupon_id;
    IF v_user_usage_count >= v_coupon.per_customer_limit THEN
      RETURN FALSE;
    END IF;
  END IF;

  -- Minimum order amount
  IF v_coupon.min_order_amount IS NOT NULL AND p_cart_total < v_coupon.min_order_amount THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
