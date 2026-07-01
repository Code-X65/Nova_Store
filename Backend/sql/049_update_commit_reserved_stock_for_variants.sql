-- Redefine commit_reserved_stock to also decrement product_variants stock
CREATE OR REPLACE FUNCTION commit_reserved_stock(p_order_id UUID)
RETURNS VOID AS $$
DECLARE
  v_item RECORD;
  v_commit_qty INT;
BEGIN
  FOR v_item IN
    SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = p_order_id
  LOOP
    -- Lock row and commit for base product
    UPDATE products
    SET stock_quantity  = stock_quantity - v_item.quantity,
        reserved_quantity = GREATEST(reserved_quantity - v_item.quantity, 0),
        status = CASE
          WHEN (stock_quantity - v_item.quantity) <= 0 THEN 'out_of_stock'
          ELSE 'published'
        END,
        updated_at = NOW()
    WHERE id = v_item.product_id;

    -- If variant_id is present, also update the variant's stock
    IF v_item.variant_id IS NOT NULL THEN
      UPDATE product_variants
      SET stock_quantity = stock_quantity - v_item.quantity,
          updated_at = NOW()
      WHERE id = v_item.variant_id;
    END IF;

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
