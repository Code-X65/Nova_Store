-- ============================================================
-- Migration 056: Single-Store Architecture — Add store_id to RPCs
-- ============================================================
-- Redefines get_low_stock_products and get_products_by_attributes
-- to return store_id so that store scoping can be applied
-- via PostgREST/Supabase client filter chain.
-- ============================================================

-- Drop the old functions first to allow changing their return types
DROP FUNCTION IF EXISTS get_low_stock_products();
DROP FUNCTION IF EXISTS public.get_products_by_attributes(JSONB);

-- 1. Redefine get_low_stock_products to return store_id
CREATE OR REPLACE FUNCTION get_low_stock_products()
RETURNS TABLE (
  id UUID,
  name TEXT,
  sku TEXT,
  stock_quantity INTEGER,
  low_stock_threshold INTEGER,
  store_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.name, p.sku, p.stock_quantity, p.low_stock_threshold, p.store_id
  FROM products p
  WHERE p.deleted_at IS NULL
  AND p.stock_quantity <= p.low_stock_threshold;
END;
$$ LANGUAGE plpgsql;

-- 2. Redefine get_products_by_attributes to return store_id
CREATE OR REPLACE FUNCTION public.get_products_by_attributes(
  attr_filters JSONB
)
RETURNS TABLE (
  id                  UUID,
  sku                 TEXT,
  name                TEXT,
  slug                TEXT,
  description         TEXT,
  short_description   TEXT,
  category            TEXT,
  category_id         UUID,
  brand               TEXT,
  brand_id            UUID,
  price               DECIMAL,
  sale_price          DECIMAL,
  discount_percentage DECIMAL,
  stock_quantity      INT,
  status              TEXT,
  is_featured         BOOLEAN,
  primary_image_url   TEXT,
  image_gallery       TEXT[],
  tags                TEXT[],
  created_at          TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ,
  store_id            UUID
)
LANGUAGE plpgsql AS $$
DECLARE
  filter_count INT;
BEGIN
  SELECT COUNT(*) INTO filter_count FROM jsonb_each_text(attr_filters);

  RETURN QUERY
  SELECT DISTINCT
    p.id, p.sku, p.name, p.slug, p.description, p.short_description,
    p.category, p.category_id, p.brand, p.brand_id,
    p.price, p.sale_price, p.discount_percentage,
    p.stock_quantity, p.status, p.is_featured,
    p.primary_image_url, p.image_gallery, p.tags,
    p.created_at, p.updated_at, p.store_id
  FROM public.products p
  WHERE
    p.deleted_at IS NULL
    AND (
      SELECT COUNT(DISTINCT ca.attribute_name)
      FROM public.product_attributes pa
      JOIN public.category_attributes ca ON ca.id = pa.attribute_id
      WHERE pa.product_id = p.id
        AND (ca.attribute_name, pa.attribute_value) IN (
          SELECT key, value FROM jsonb_each_text(attr_filters)
        )
    ) = filter_count;
END;
$$;

-- Grant permissions explicitly
GRANT EXECUTE ON FUNCTION public.get_products_by_attributes(JSONB) TO anon, authenticated, service_role;
