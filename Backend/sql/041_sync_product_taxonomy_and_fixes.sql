-- ============================================================
-- Migration: 041_sync_product_taxonomy_and_fixes.sql
-- Synchronizes taxonomy, validates subcategories, handles soft deletes,
-- adds date attribute validations, and re-declares critical RPCs.
-- ============================================================

-- ============================================================
-- 1. PRODUCTS — Add subcategory_id and default rating columns
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_count    INT          DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_products_subcategory_id ON public.products(subcategory_id);


-- ============================================================
-- 2. BRANDS — Validate website URL
-- ============================================================

ALTER TABLE public.product_brands DROP CONSTRAINT IF EXISTS chk_product_brands_website_url;
ALTER TABLE public.product_brands ADD CONSTRAINT chk_product_brands_website_url
  CHECK (website_url IS NULL OR website_url ~* '^https?://[^\s/$.?#].[^\s]*$');


-- ============================================================
-- 3. AUTO-SYNC TAXONOMY SLUGS TRIGGER (category, subcategory, brand)
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_product_category_brand_slugs()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Sync category TEXT slug from category_id
  IF (TG_OP = 'INSERT' AND NEW.category_id IS NOT NULL) OR 
     (TG_OP = 'UPDATE' AND NEW.category_id IS DISTINCT FROM OLD.category_id) THEN
    IF NEW.category_id IS NOT NULL THEN
      SELECT slug INTO NEW.category FROM public.product_categories WHERE id = NEW.category_id;
    ELSE
      NEW.category := NULL;
    END IF;
  END IF;

  -- Sync subcategory TEXT slug from subcategory_id
  IF (TG_OP = 'INSERT' AND NEW.subcategory_id IS NOT NULL) OR 
     (TG_OP = 'UPDATE' AND NEW.subcategory_id IS DISTINCT FROM OLD.subcategory_id) THEN
    IF NEW.subcategory_id IS NOT NULL THEN
      SELECT slug INTO NEW.subcategory FROM public.product_categories WHERE id = NEW.subcategory_id;
    ELSE
      NEW.subcategory := NULL;
    END IF;
  END IF;

  -- Sync brand TEXT name from brand_id
  IF (TG_OP = 'INSERT' AND NEW.brand_id IS NOT NULL) OR 
     (TG_OP = 'UPDATE' AND NEW.brand_id IS DISTINCT FROM OLD.brand_id) THEN
    IF NEW.brand_id IS NOT NULL THEN
      SELECT name INTO NEW.brand FROM public.product_brands WHERE id = NEW.brand_id;
    ELSE
      NEW.brand := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_product_category_brand_slugs ON public.products;
CREATE TRIGGER trg_sync_product_category_brand_slugs
  BEFORE INSERT OR UPDATE OF category_id, subcategory_id, brand_id ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.sync_product_category_brand_slugs();


-- ============================================================
-- 4. VALIDATE SUBCATEGORY RELATION TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_product_subcategory()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_parent_id UUID;
BEGIN
  IF NEW.subcategory_id IS NOT NULL THEN
    IF NEW.category_id IS NULL THEN
      RAISE EXCEPTION 'Cannot set subcategory without a primary category';
    END IF;

    SELECT parent_id INTO v_parent_id
      FROM public.product_categories
      WHERE id = NEW.subcategory_id;
      
    IF v_parent_id IS NULL OR v_parent_id != NEW.category_id THEN
      RAISE EXCEPTION 'Subcategory % must be a child of primary category %',
        NEW.subcategory_id, NEW.category_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_product_subcategory ON public.products;
CREATE TRIGGER trg_validate_product_subcategory
  BEFORE INSERT OR UPDATE OF category_id, subcategory_id ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.validate_product_subcategory();


-- ============================================================
-- 5. ATTRIBUTES — Support Date Type & Date Format Validation
-- ============================================================

ALTER TABLE public.category_attributes DROP CONSTRAINT IF EXISTS category_attributes_attribute_type_check;
ALTER TABLE public.category_attributes ADD CONSTRAINT category_attributes_attribute_type_check 
  CHECK (attribute_type IN ('text', 'number', 'boolean', 'enum', 'date'));

CREATE OR REPLACE FUNCTION public.validate_product_attribute_value()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_type          TEXT;
  v_allowed       TEXT[];
BEGIN
  SELECT attribute_type, allowed_values
    INTO v_type, v_allowed
    FROM public.category_attributes
    WHERE id = NEW.attribute_id;

  -- Validate enum values
  IF v_type = 'enum' AND v_allowed IS NOT NULL AND array_length(v_allowed, 1) > 0 THEN
    IF NOT (NEW.attribute_value = ANY(v_allowed)) THEN
      RAISE EXCEPTION
        'Invalid attribute value "%" for attribute %. Allowed values: %',
        NEW.attribute_value,
        NEW.attribute_id,
        array_to_string(v_allowed, ', ');
    END IF;
  END IF;

  -- Validate number values
  IF v_type = 'number' THEN
    IF NEW.attribute_value !~ '^-?[0-9]+(\.[0-9]+)?$' THEN
      RAISE EXCEPTION
        'Attribute value "%" must be a valid number for attribute %.',
        NEW.attribute_value,
        NEW.attribute_id;
    END IF;
  END IF;

  -- Validate boolean values
  IF v_type = 'boolean' THEN
    IF lower(NEW.attribute_value) NOT IN ('true', 'false', '1', '0', 'yes', 'no') THEN
      RAISE EXCEPTION
        'Attribute value "%" must be a boolean (true/false) for attribute %.',
        NEW.attribute_value,
        NEW.attribute_id;
    END IF;
  END IF;

  -- Validate date values
  IF v_type = 'date' THEN
    -- Regex supports YYYY-MM-DD and full ISO-8601 strings
    IF NEW.attribute_value !~ '^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$' THEN
      RAISE EXCEPTION
        'Attribute value "%" must be a valid date/ISO-8601 string for attribute %.',
        NEW.attribute_value,
        NEW.attribute_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ============================================================
-- 6. ATTRIBUTE INTEGRITY — Cleanup attributes on Category change
-- ============================================================

CREATE OR REPLACE FUNCTION public.cleanup_orphaned_product_attributes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.product_attributes pa
  USING public.category_attributes ca
  WHERE pa.product_id = NEW.id
    AND pa.attribute_id = ca.id
    AND ca.category_id IS DISTINCT FROM NEW.category_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_orphaned_product_attributes ON public.products;
CREATE TRIGGER trg_cleanup_orphaned_product_attributes
  AFTER UPDATE OF category_id ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_orphaned_product_attributes();


-- ============================================================
-- 7. SOFT DELETE CASCADE TRIGGERS (Brand & Category)
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_brand_soft_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.products
      SET brand_id = NULL
      WHERE brand_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_brand_soft_delete ON public.product_brands;
CREATE TRIGGER trg_handle_brand_soft_delete
  AFTER UPDATE OF deleted_at ON public.product_brands
  FOR EACH ROW EXECUTE FUNCTION public.handle_brand_soft_delete();

CREATE OR REPLACE FUNCTION public.handle_category_soft_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.products
      SET category_id = NULL,
          subcategory_id = NULL
      WHERE category_id = NEW.id OR subcategory_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_category_soft_delete ON public.product_categories;
CREATE TRIGGER trg_handle_category_soft_delete
  AFTER UPDATE OF deleted_at ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_category_soft_delete();


-- ============================================================
-- 8. REDEFINE/ENSURE CRITICAL RPC FUNCTIONS EXIST
-- ============================================================

-- reserve_stock_increment
CREATE OR REPLACE FUNCTION reserve_stock_increment(p_product_id UUID, p_quantity INT)
RETURNS JSONB AS $$
DECLARE
  v_product JSONB;
BEGIN
  UPDATE products
  SET reserved_quantity = COALESCE(reserved_quantity, 0) + p_quantity,
      updated_at = NOW()
  WHERE id = p_product_id
    AND (COALESCE(reserved_quantity, 0) + p_quantity) <= COALESCE(stock_quantity, 0)
  RETURNING row_to_json(products.*) INTO v_product;

  RETURN v_product;
END;
$$ LANGUAGE plpgsql;

-- release_stock_reservation
CREATE OR REPLACE FUNCTION release_stock_reservation(p_product_id UUID, p_variant_id UUID DEFAULT NULL, p_quantity INT DEFAULT 1)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET reserved_quantity = GREATEST(COALESCE(reserved_quantity, 0) - p_quantity, 0),
      updated_at = NOW()
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- get_low_stock_products
CREATE OR REPLACE FUNCTION get_low_stock_products()
RETURNS TABLE (
  id UUID,
  name TEXT,
  sku TEXT,
  stock_quantity INTEGER,
  low_stock_threshold INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.name, p.sku, p.stock_quantity, p.low_stock_threshold
  FROM products p
  WHERE p.deleted_at IS NULL
  AND p.stock_quantity <= p.low_stock_threshold;
END;
$$ LANGUAGE plpgsql;

-- get_products_by_attributes
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
  updated_at          TIMESTAMPTZ
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
    p.created_at, p.updated_at
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


-- ============================================================
-- 9. BACKFILL EXISTING PRODUCTS TAXONOMY
-- ============================================================

UPDATE public.products p
SET category = pc.slug
FROM public.product_categories pc
WHERE p.category_id = pc.id AND p.category IS DISTINCT FROM pc.slug;

UPDATE public.products p
SET brand = pb.name
FROM public.product_brands pb
WHERE p.brand_id = pb.id AND p.brand IS DISTINCT FROM pb.name;
