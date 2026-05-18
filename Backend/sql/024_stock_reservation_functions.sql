-- Atomic stock reservation functions (Item 9)

-- reserve_stock_increment: atomically increment reserved_quantity only if
-- reserved + quantity <= stock_quantity. Returns the updated product row.
CREATE OR REPLACE FUNCTION reserve_stock_increment(p_product_id UUID, p_quantity INT)
RETURNS JSONB AS $$
DECLARE
  v_product JSONB;
BEGIN
  UPDATE products
  SET reserved_quantity = reserved_quantity + p_quantity,
      updated_at = NOW()
  WHERE id = p_product_id
    AND (reserved_quantity + p_quantity) <= COALESCE(stock_quantity, 0)
  RETURNING row_to_json(products.*) INTO v_product;

  RETURN v_product;
END;
$$ LANGUAGE plpgsql;

-- release_stock_reservation: atomically decrement reserved_quantity
CREATE OR REPLACE FUNCTION release_stock_reservation(p_product_id UUID, p_variant_id UUID DEFAULT NULL, p_quantity INT DEFAULT 1)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET reserved_quantity = GREATEST(reserved_quantity - p_quantity, 0),
      updated_at = NOW()
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- commit_reserved_stock: after a successful order, reduce stock_quantity by the
-- amount reserved for the order and zero out reserved_quantity for that order.
CREATE OR REPLACE FUNCTION commit_reserved_stock(p_order_id UUID)
RETURNS VOID AS $$
DECLARE
  v_item RECORD;
  v_commit_qty INT;
BEGIN
  FOR v_item IN
    SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = p_order_id
  LOOP
    -- Lock row and commit
    UPDATE products
    SET stock_quantity  = stock_quantity - v_item.quantity,
        reserved_quantity = GREATEST(reserved_quantity - v_item.quantity, 0),
        status = CASE
          WHEN (stock_quantity - v_item.quantity) <= 0 THEN 'out_of_stock'
          ELSE 'published'
        END,
        updated_at = NOW()
    WHERE id = v_item.product_id;

    -- Mark reservation as fulfilled
    UPDATE inventory_reservations
    SET order_id = p_order_id,
        expires_at = NOW()
    WHERE product_id  = v_item.product_id
      AND (variant_id = v_item.variant_id OR variant_id IS NULL AND v_item.variant_id IS NULL)
      AND order_id IS NULL;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- release_session_reservations: release any stale reservation linked to a session
-- (called when checkout session expires or is cancelled before payment).
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

    DELETE FROM inventory_reservations WHERE id = v_reservation.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
