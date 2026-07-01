-- Create function to atomically release expired stock reservations
CREATE OR REPLACE FUNCTION release_expired_reservations()
RETURNS INT AS $$
DECLARE
  v_reservation RECORD;
  v_count INT := 0;
BEGIN
  FOR v_reservation IN
    SELECT id, product_id, quantity
    FROM inventory_reservations
    WHERE expires_at < NOW()
      AND order_id IS NULL
  LOOP
    -- Restore reserved stock back to base product
    UPDATE products
    SET reserved_quantity = GREATEST(COALESCE(reserved_quantity, 0) - v_reservation.quantity, 0),
        updated_at = NOW()
    WHERE id = v_reservation.product_id;

    -- Delete the expired reservation
    DELETE FROM inventory_reservations WHERE id = v_reservation.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;
