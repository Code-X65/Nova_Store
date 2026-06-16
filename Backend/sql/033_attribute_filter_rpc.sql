-- ============================================================
-- Migration: 033_attribute_filter_rpc.sql
-- Postgres RPC function for attribute-based product filtering
-- Used by GET /products?attr_RAM=8GB&attr_Storage=256GB
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_products_by_attributes(
  attr_filters JSONB  -- e.g. '{"RAM": "8GB", "Storage": "256GB"}'
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
  updated_at          TIMESTAMPTZ
)
LANGUAGE plpgsql AS $$
DECLARE
  filter_count INT;
  attr_key     TEXT;
  attr_val     TEXT;
BEGIN
  -- Count how many filters we need to satisfy
  SELECT COUNT(*) INTO filter_count FROM jsonb_each_text(attr_filters);

  RETURN QUERY
  SELECT DISTINCT
    p.id, p.sku, p.name, p.slug, p.description, p.short_description,
    p.category, p.category_id, p.brand, p.brand_id,
    p.price, p.sale_price, p.discount_percentage,
    p.stock_quantity, p.status, p.is_featured,
    p.primary_image_url, p.image_gallery, p.tags,
    p.created_at, p.updated_at
  FROM public.products p
  WHERE
    p.deleted_at IS NULL
    AND (
      -- Product must have matching values for ALL supplied filters
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

GRANT EXECUTE ON FUNCTION public.get_products_by_attributes(JSONB) TO anon, authenticated, service_role;
