-- Fix schema gaps found in Store Catalogs audit:
-- 1. Admin UI sends `color` for products and categories, but no column existed for either.
-- 2. products.category (legacy free-text taxonomy) is NOT NULL but nothing sends or backfills it
--    since category_id (FK) became the canonical taxonomy field in 031_connect_products_categories.sql.

ALTER TABLE products ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS color TEXT;

ALTER TABLE products ALTER COLUMN category DROP NOT NULL;
