-- Migration: Make SKU optional
-- 059_make_sku_optional.sql

-- Drop NOT NULL constraints from products and product_variants tables
ALTER TABLE products ALTER COLUMN sku DROP NOT NULL;
ALTER TABLE product_variants ALTER COLUMN sku DROP NOT NULL;

-- Note: The UNIQUE constraint on sku remains, meaning non-null SKUs must still be unique.
-- PostgreSQL allows multiple NULL values in a UNIQUE column.
