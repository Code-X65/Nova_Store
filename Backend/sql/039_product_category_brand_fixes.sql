-- ============================================================
-- Migration: 039_product_category_brand_fixes.sql
-- Gap analysis fixes for products, categories, and brands
-- ============================================================

-- ============================================================
-- 1. PRODUCTS — Add thumbnail_url and currency
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS currency      TEXT NOT NULL DEFAULT 'USD';

COMMENT ON COLUMN public.products.thumbnail_url IS 'Small/optimised image URL for product listing cards (separate from primary_image_url)';
COMMENT ON COLUMN public.products.currency       IS 'ISO-4217 currency code for product pricing (e.g. USD, NGN, GBP)';

-- ============================================================
-- 2. CATEGORIES — Add thumbnail_url and SEO fields
-- ============================================================

ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS thumbnail_url    TEXT,
  ADD COLUMN IF NOT EXISTS meta_title       TEXT,
  ADD COLUMN IF NOT EXISTS meta_description TEXT,
  ADD COLUMN IF NOT EXISTS meta_keywords    TEXT[];

COMMENT ON COLUMN public.product_categories.thumbnail_url    IS 'Small/optimised category thumbnail (separate from image_url)';
COMMENT ON COLUMN public.product_categories.meta_title       IS 'SEO title tag for the category listing page';
COMMENT ON COLUMN public.product_categories.meta_description IS 'SEO meta description for the category listing page';
COMMENT ON COLUMN public.product_categories.meta_keywords    IS 'SEO keywords array for the category listing page';


-- ============================================================
-- 3. BRANDS — Add thumbnail_url, website_url, and SEO fields
-- ============================================================

ALTER TABLE public.product_brands
  ADD COLUMN IF NOT EXISTS thumbnail_url    TEXT,
  ADD COLUMN IF NOT EXISTS website_url      TEXT,
  ADD COLUMN IF NOT EXISTS meta_title       TEXT,
  ADD COLUMN IF NOT EXISTS meta_description TEXT,
  ADD COLUMN IF NOT EXISTS meta_keywords    TEXT[];

COMMENT ON COLUMN public.product_brands.thumbnail_url    IS 'Small/optimised brand logo thumbnail (separate from logo_url)';
COMMENT ON COLUMN public.product_brands.website_url      IS 'Official brand website URL';
COMMENT ON COLUMN public.product_brands.meta_title       IS 'SEO title tag for the brand landing page';
COMMENT ON COLUMN public.product_brands.meta_description IS 'SEO meta description for the brand landing page';
COMMENT ON COLUMN public.product_brands.meta_keywords    IS 'SEO keywords array for the brand landing page';


-- ============================================================
-- 4. AUTO-SYNC PRODUCT COUNT — Categories (via assignment table)
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_category_product_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.product_categories
      SET product_count = product_count + 1
      WHERE id = NEW.category_id;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.product_categories
      SET product_count = GREATEST(product_count - 1, 0)
      WHERE id = OLD.category_id;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_category_product_count ON public.product_category_assignments;
CREATE TRIGGER trg_sync_category_product_count
  AFTER INSERT OR DELETE ON public.product_category_assignments
  FOR EACH ROW EXECUTE FUNCTION public.sync_category_product_count();


-- ============================================================
-- 5. AUTO-SYNC PRODUCT COUNT — Brands (via products.brand_id)
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_brand_product_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- On INSERT: increment the new brand
  IF TG_OP = 'INSERT' AND NEW.brand_id IS NOT NULL THEN
    UPDATE public.product_brands
      SET product_count = product_count + 1
      WHERE id = NEW.brand_id;

  -- On DELETE: decrement the old brand
  ELSIF TG_OP = 'DELETE' AND OLD.brand_id IS NOT NULL THEN
    UPDATE public.product_brands
      SET product_count = GREATEST(product_count - 1, 0)
      WHERE id = OLD.brand_id;

  -- On UPDATE: handle brand change
  ELSIF TG_OP = 'UPDATE' AND OLD.brand_id IS DISTINCT FROM NEW.brand_id THEN
    IF OLD.brand_id IS NOT NULL THEN
      UPDATE public.product_brands
        SET product_count = GREATEST(product_count - 1, 0)
        WHERE id = OLD.brand_id;
    END IF;
    IF NEW.brand_id IS NOT NULL THEN
      UPDATE public.product_brands
        SET product_count = product_count + 1
        WHERE id = NEW.brand_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_brand_product_count ON public.products;
CREATE TRIGGER trg_sync_brand_product_count
  AFTER INSERT OR UPDATE OF brand_id OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.sync_brand_product_count();


-- ============================================================
-- 6. AUTO-SYNC PRODUCT COUNT — Categories (via products.category_id)
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_category_direct_product_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.category_id IS NOT NULL THEN
    UPDATE public.product_categories
      SET product_count = product_count + 1
      WHERE id = NEW.category_id;

  ELSIF TG_OP = 'DELETE' AND OLD.category_id IS NOT NULL THEN
    UPDATE public.product_categories
      SET product_count = GREATEST(product_count - 1, 0)
      WHERE id = OLD.category_id;

  ELSIF TG_OP = 'UPDATE' AND OLD.category_id IS DISTINCT FROM NEW.category_id THEN
    IF OLD.category_id IS NOT NULL THEN
      UPDATE public.product_categories
        SET product_count = GREATEST(product_count - 1, 0)
        WHERE id = OLD.category_id;
    END IF;
    IF NEW.category_id IS NOT NULL THEN
      UPDATE public.product_categories
        SET product_count = product_count + 1
        WHERE id = NEW.category_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_category_direct_product_count ON public.products;
CREATE TRIGGER trg_sync_category_direct_product_count
  AFTER INSERT OR UPDATE OF category_id OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.sync_category_direct_product_count();


-- ============================================================
-- 7. ATTRIBUTE VALUE VALIDATION — Enum enforcement trigger
-- ============================================================

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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_product_attribute_value ON public.product_attributes;
CREATE TRIGGER trg_validate_product_attribute_value
  BEFORE INSERT OR UPDATE ON public.product_attributes
  FOR EACH ROW EXECUTE FUNCTION public.validate_product_attribute_value();
