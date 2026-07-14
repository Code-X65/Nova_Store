-- Drop the old constraint
ALTER TABLE inventory_transactions DROP CONSTRAINT IF EXISTS inventory_transactions_type_check;

-- Add the new constraint with expanded allowed types matching the frontend reason codes
ALTER TABLE inventory_transactions ADD CONSTRAINT inventory_transactions_type_check 
CHECK (type IN ('sale', 'restock', 'adjustment', 'return', 'reservation', 'damaged', 'correction', 'loss', 'other'));
