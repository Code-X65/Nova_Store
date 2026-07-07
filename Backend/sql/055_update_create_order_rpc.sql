-- ============================================================
-- Migration 055: Single-Store Architecture — Update create_order_with_items RPC
-- ============================================================
-- Updates the create_order_with_items function to accept and
-- insert store_id.
-- ============================================================

CREATE OR REPLACE FUNCTION create_order_with_items(
  p_order_data JSONB,
  p_order_items JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_order_id UUID;
  v_result JSONB;
BEGIN
  -- Insert Order
  INSERT INTO orders (
    user_id, order_number, subtotal, shipping_cost, tax_amount, 
    discount_amount, total_amount, coupon_id, shipping_address, 
    shipping_method, customer_email, customer_phone, notes, checkout_session_id,
    store_id
  )
  VALUES (
    (p_order_data->>'user_id')::UUID,
    p_order_data->>'order_number',
    (p_order_data->>'subtotal')::DECIMAL,
    (p_order_data->>'shipping_cost')::DECIMAL,
    (p_order_data->>'tax_amount')::DECIMAL,
    (p_order_data->>'discount_amount')::DECIMAL,
    (p_order_data->>'total_amount')::DECIMAL,
    (p_order_data->>'coupon_id')::UUID,
    (p_order_data->'shipping_address')::JSONB,
    p_order_data->>'shipping_method',
    p_order_data->>'customer_email',
    p_order_data->>'customer_phone',
    p_order_data->>'notes',
    (p_order_data->>'checkout_session_id')::UUID,
    (p_order_data->>'store_id')::UUID
  )
  RETURNING id INTO v_order_id;

  -- Insert Items
  INSERT INTO order_items (
    order_id, product_id, variant_id, product_name, sku, quantity, unit_price, total_price
  )
  SELECT 
    v_order_id,
    (item->>'product_id')::UUID,
    (item->>'variant_id')::UUID,
    item->>'product_name',
    item->>'sku',
    (item->>'quantity')::INT,
    (item->>'unit_price')::DECIMAL,
    (item->>'total_price')::DECIMAL
  FROM jsonb_array_elements(p_order_items) AS item;

  -- Return created order
  SELECT jsonb_build_object('id', v_order_id) INTO v_result;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;
