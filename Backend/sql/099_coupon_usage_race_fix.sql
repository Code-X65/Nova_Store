-- Coupon usage was only recorded on PAYMENT SUCCESS (recordCouponUsage), not at
-- order-creation time, so two concurrent checkouts could both pass
-- is_coupon_valid_for_user's usage-limit/per-customer-limit checks before either
-- had actually recorded usage. Close this check-then-act race by atomically
-- claiming the usage slot at order creation (mirrors how stock reservation
-- already avoids the equivalent race for inventory).

-- Tie a pending claim back to the exact order that created it, so it can be
-- released precisely on cancellation/payment failure (not just by user+coupon,
-- which would be ambiguous if a customer had two concurrent orders).
ALTER TABLE user_coupons ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;

-- Atomically claim a coupon usage slot (global usage_limit + per-customer limit)
-- for a given order. Returns TRUE if the claim succeeded, FALSE if either limit
-- was already reached. Call this at order creation, not at payment success.
CREATE OR REPLACE FUNCTION claim_coupon_usage(p_coupon_id UUID, p_user_id UUID, p_order_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_per_customer_limit INT;
  v_user_usage_count INT;
  v_claimed BOOLEAN := FALSE;
BEGIN
  -- Atomically claim the global usage slot.
  UPDATE coupons
  SET used_count = used_count + 1
  WHERE id = p_coupon_id
    AND (usage_limit IS NULL OR used_count < usage_limit)
  RETURNING TRUE INTO v_claimed;

  IF NOT v_claimed THEN
    RETURN FALSE;
  END IF;

  -- Atomically claim the per-customer slot (registered users only — guest
  -- per-email limits are enforced separately against the orders table).
  IF p_user_id IS NOT NULL THEN
    SELECT per_customer_limit INTO v_per_customer_limit FROM coupons WHERE id = p_coupon_id;
    IF v_per_customer_limit IS NOT NULL THEN
      SELECT COUNT(*) INTO v_user_usage_count FROM user_coupons WHERE user_id = p_user_id AND coupon_id = p_coupon_id;
      IF v_user_usage_count >= v_per_customer_limit THEN
        UPDATE coupons SET used_count = GREATEST(used_count - 1, 0) WHERE id = p_coupon_id;
        RETURN FALSE;
      END IF;
    END IF;
    INSERT INTO user_coupons (user_id, coupon_id, order_id, used_at) VALUES (p_user_id, p_coupon_id, p_order_id, NULL);
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Release a claimed-but-never-paid coupon usage (order cancelled or payment failed).
CREATE OR REPLACE FUNCTION release_coupon_usage(p_coupon_id UUID, p_order_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE coupons SET used_count = GREATEST(used_count - 1, 0) WHERE id = p_coupon_id;
  DELETE FROM user_coupons WHERE coupon_id = p_coupon_id AND order_id = p_order_id AND used_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Confirm a claimed usage on payment success (marks the existing claim row
-- rather than inserting a fresh, unlinked one). Falls back to inserting a
-- confirmed record directly if no claim exists (e.g. a coupon applied through
-- a legacy path that never called claim_coupon_usage).
CREATE OR REPLACE FUNCTION confirm_coupon_usage(p_coupon_id UUID, p_order_id UUID, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE user_coupons
  SET used_at = NOW()
  WHERE coupon_id = p_coupon_id AND order_id = p_order_id AND user_id = p_user_id AND used_at IS NULL;

  IF NOT FOUND THEN
    INSERT INTO user_coupons (user_id, coupon_id, order_id, used_at)
    VALUES (p_user_id, p_coupon_id, p_order_id, NOW());
  END IF;
END;
$$ LANGUAGE plpgsql;
