-- 031_connect_products_categories.sql
-- Add category_id foreign key to products table and migrate existing category assignments

-- 1. Add category_id foreign key column referencing product_categories(id)
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL;

-- 2. Populate category_id for existing products by matching their category slug against product_categories
UPDATE products p
SET category_id = pc.id
FROM product_categories pc
WHERE p.category = pc.slug;

-- 3. Create an index on the category_id column for performance
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
