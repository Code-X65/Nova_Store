-- Prevent negative stock quantities at the database level
ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_stock_non_negative;
ALTER TABLE products ADD CONSTRAINT chk_products_stock_non_negative CHECK (stock_quantity >= 0);

ALTER TABLE product_variants DROP CONSTRAINT IF EXISTS chk_product_variants_stock_non_negative;
ALTER TABLE product_variants ADD CONSTRAINT chk_product_variants_stock_non_negative CHECK (stock_quantity >= 0);

-- Prevent negative reserved quantities
ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_reserved_non_negative;
ALTER TABLE products ADD CONSTRAINT chk_products_reserved_non_negative CHECK (reserved_quantity >= 0);

ALTER TABLE product_variants DROP CONSTRAINT IF EXISTS chk_product_variants_reserved_non_negative;
ALTER TABLE product_variants ADD CONSTRAINT chk_product_variants_reserved_non_negative CHECK (reserved_quantity >= 0);
