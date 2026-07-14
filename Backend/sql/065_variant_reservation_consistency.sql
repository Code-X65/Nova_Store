-- Inventory reservation variant consistency fix
-- Adds reserved_quantity tracking to product_variants and updates all
-- reservation RPCs to also update variant stock when a variant_id is provided.

-- 1. Add reserved_quantity to product_variants
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS reserved_quantity INT DEFAULT 0;

-- 2. Update reserve_stock_increment to also handle variants
CREATE OR REPLACE FUNCTION reserve_stock_increment(p_product_id UUID, p_quantity INT, p_variant_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_product JSONB;
BEGIN
  -- Reserve on base product
  UPDATE products
  SET reserved_quantity = reserved_quantity + p_quantity,
      updated_at = NOW()
  WHERE id = p_product_id
    AND (reserved_quantity + p_quantity) <= COALESCE(stock_quantity, 0)
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
      AND (reserved_quantity + p_quantity) <= COALESCE(stock_quantity, 0);

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

-- 3. Update release_stock_reservation to also handle variants
CREATE OR REPLACE FUNCTION release_stock_reservation(p_product_id UUID, p_variant_id UUID DEFAULT NULL, p_quantity INT DEFAULT 1)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET reserved_quantity = GREATEST(reserved_quantity - p_quantity, 0),
      updated_at = NOW()
  WHERE id = p_product_id;

  IF p_variant_id IS NOT NULL THEN
    UPDATE product_variants
    SET reserved_quantity = GREATEST(reserved_quantity - p_quantity, 0),
        updated_at = NOW()
    WHERE id = p_variant_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 4. Update release_session_reservations to also handle variants
CREATE OR REPLACE FUNCTION release_session_reservations(p_session_id TEXT)
RETURNS VOID AS $$
DECLARE
  v_reservation RECORD;
BEGIN
  FOR v_reservation IN
    SELECT id, product_id, variant_id, quantity
    FROM inventory_reservations
    WHERE checkout_session_id = p_session_id
      AND order_id IS NULL
  LOOP
    UPDATE products
    SET reserved_quantity = GREATEST(reserved_quantity - v_reservation.quantity, 0),
        updated_at = NOW()
    WHERE id = v_reservation.product_id;

    IF v_reservation.variant_id IS NOT NULL THEN
      UPDATE product_variants
      SET reserved_quantity = GREATEST(reserved_quantity - v_reservation.quantity, 0),
          updated_at = NOW()
      WHERE id = v_reservation.variant_id;
    END IF;

    DELETE FROM inventory_reservations WHERE id = v_reservation.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 5. Update release_expired_reservations to also handle variants
CREATE OR REPLACE FUNCTION release_expired_reservations()
RETURNS INT AS $$
DECLARE
  v_reservation RECORD;
  v_count INT := 0;
BEGIN
  FOR v_reservation IN
    SELECT id, product_id, variant_id, quantity
    FROM inventory_reservations
    WHERE expires_at < NOW()
      AND order_id IS NULL
  LOOP
    UPDATE products
    SET reserved_quantity = GREATEST(COALESCE(reserved_quantity, 0) - v_reservation.quantity, 0),
        updated_at = NOW()
    WHERE id = v_reservation.product_id;

    IF v_reservation.variant_id IS NOT NULL THEN
      UPDATE product_variants
      SET reserved_quantity = GREATEST(COALESCE(reserved_quantity, 0) - v_reservation.quantity, 0),
          updated_at = NOW()
      WHERE id = v_reservation.variant_id;
    END IF;

    DELETE FROM inventory_reservations WHERE id = v_reservation.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;
