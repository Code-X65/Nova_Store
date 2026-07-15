-- Products/variants with allow_backorder = true were honored at add-to-cart time
-- (cart.service.js) but silently ignored at the actual stock-reservation guard,
-- so a backorder-enabled product could be cart-added yet still hard-fail at
-- checkout once stock hit 0. Make reserve_stock_increment backorder-aware to
-- match the application-level check in checkout.service.js.

CREATE OR REPLACE FUNCTION reserve_stock_increment(p_product_id UUID, p_quantity INT, p_variant_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_product JSONB;
  v_allow_backorder BOOLEAN;
BEGIN
  SELECT allow_backorder INTO v_allow_backorder FROM products WHERE id = p_product_id;

  -- Reserve on base product
  UPDATE products
  SET reserved_quantity = reserved_quantity + p_quantity,
      updated_at = NOW()
  WHERE id = p_product_id
    AND (COALESCE(v_allow_backorder, FALSE) OR (reserved_quantity + p_quantity) <= COALESCE(stock_quantity, 0))
  RETURNING row_to_json(products.*) INTO v_product;

  IF v_product IS NULL THEN
    RETURN NULL;
  END IF;

  -- Also reserve on variant if provided
  IF p_variant_id IS NOT NULL THEN
    UPDATE product_variants
    SET reserved_quantity = reserved_quantity + p_quantity,
        updated_at = NOW()
    WHERE id = p_variant_id
      AND (COALESCE(v_allow_backorder, FALSE) OR (reserved_quantity + p_quantity) <= COALESCE(stock_quantity, 0));

    IF NOT FOUND THEN
      -- Rollback product reservation if variant reservation fails
      UPDATE products
      SET reserved_quantity = GREATEST(reserved_quantity - p_quantity, 0),
          updated_at = NOW()
      WHERE id = p_product_id;
      RETURN NULL;
    END IF;
  END IF;

  RETURN v_product;
END;
$$ LANGUAGE plpgsql;
