-- Add UNIQUE constraint to checkout_session_id column in orders table
ALTER TABLE orders 
  ADD CONSTRAINT uq_orders_checkout_session_id UNIQUE (checkout_session_id);
