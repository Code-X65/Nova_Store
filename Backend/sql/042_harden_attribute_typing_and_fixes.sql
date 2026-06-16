-- ============================================================
-- Migration: 042_harden_attribute_typing_and_fixes.sql
-- Hardens attributes typing, adds range query support to RPC,
-- validates ISO-4217 currencies, and backfills data.
-- ============================================================

-- ============================================================
-- 1. PRODUCTS — Add ISO-4217 currency CHECK constraint
-- ============================================================

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS chk_products_currency;
ALTER TABLE public.products ADD CONSTRAINT chk_products_currency
  CHECK (currency ~ '^[A-Z]{3}$');


-- ============================================================
-- 2. ATTRIBUTES — Migrate attribute_value to JSONB (with type-casting)
-- ============================================================

-- A. Alter column type to JSONB first by converting string to JSONB string
ALTER TABLE public.product_attributes ALTER COLUMN attribute_value TYPE JSONB USING to_jsonb(attribute_value);

-- B. Update values to actual JSON numbers for numeric attributes
UPDATE public.product_attributes pa
SET attribute_value = to_jsonb((pa.attribute_value#>>'{}')::numeric)
FROM public.category_attributes ca
WHERE pa.attribute_id = ca.id
  AND ca.attribute_type = 'number'
  AND pa.attribute_value#>>'{}' ~ '^-?[0-9]+(\.[0-9]+)?$';

-- C. Update values to actual JSON booleans for boolean attributes
UPDATE public.product_attributes pa
SET attribute_value = to_jsonb(true)
FROM public.category_attributes ca
WHERE pa.attribute_id = ca.id
  AND ca.attribute_type = 'boolean'
  AND lower(pa.attribute_value#>>'{}') IN ('true', '1', 'yes');

UPDATE public.product_attributes pa
SET attribute_value = to_jsonb(false)
FROM public.category_attributes ca
WHERE pa.attribute_id = ca.id
  AND ca.attribute_type = 'boolean'
  AND lower(pa.attribute_value#>>'{}') IN ('false', '0', 'no');


-- D. Update attribute value validation trigger to validate JSONB types
CREATE OR REPLACE FUNCTION public.validate_product_attribute_value()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_type          TEXT;
  v_allowed       TEXT[];
  v_str_val       TEXT;
BEGIN
  SELECT attribute_type, allowed_values
    INTO v_type, v_allowed
    FROM public.category_attributes
    WHERE id = NEW.attribute_id;

  -- Extract string representation for checking regex/enums
  v_str_val := NEW.attribute_value#>>'{}';

  -- Validate enum values
  IF v_type = 'enum' AND v_allowed IS NOT NULL AND array_length(v_allowed, 1) > 0 THEN
    IF NOT (v_str_val = ANY(v_allowed)) THEN
      RAISE EXCEPTION
        'Invalid attribute value "%" for attribute %. Allowed values: %',
        v_str_val,
        NEW.attribute_id,
        array_to_string(v_allowed, ', ');
    END IF;
  END IF;

  -- Validate number values
  IF v_type = 'number' THEN
    IF jsonb_typeof(NEW.attribute_value) != 'number' THEN
      IF v_str_val !~ '^-?[0-9]+(\.[0-9]+)?$' THEN
        RAISE EXCEPTION
          'Attribute value "%" must be a valid number for attribute %.',
          v_str_val,
          NEW.attribute_id;
      END IF;
    END IF;
  END IF;

  -- Validate boolean values
  IF v_type = 'boolean' THEN
    IF jsonb_typeof(NEW.attribute_value) != 'boolean' THEN
      IF lower(v_str_val) NOT IN ('true', 'false', '1', '0', 'yes', 'no') THEN
        RAISE EXCEPTION
          'Attribute value "%" must be a boolean (true/false) for attribute %.',
          v_str_val,
          NEW.attribute_id;
      END IF;
    END IF;
  END IF;

  -- Validate date values
  IF v_type = 'date' THEN
    IF v_str_val !~ '^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$' THEN
      RAISE EXCEPTION
        'Attribute value "%" must be a valid date/ISO-8601 string for attribute %.',
        v_str_val,
        NEW.attribute_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- E. Update orphaned product attributes trigger to clean up on category_id OR subcategory_id updates
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_product_attributes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.product_attributes pa
  USING public.category_attributes ca
  WHERE pa.product_id = NEW.id
    AND pa.attribute_id = ca.id
    AND ca.category_id IS DISTINCT FROM NEW.category_id
    AND ca.category_id IS DISTINCT FROM NEW.subcategory_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_orphaned_product_attributes ON public.products;
CREATE TRIGGER trg_cleanup_orphaned_product_attributes
  AFTER UPDATE OF category_id, subcategory_id ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_orphaned_product_attributes();


-- ============================================================
-- 3. PRODUCTS BY ATTRIBUTES RPC — Support range/prefix queries on numbers
-- ============================================================

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
      JOIN jsonb_each_text(attr_filters) f ON ca.attribute_name = f.key
      WHERE pa.product_id = p.id
        AND (
          CASE 
            -- Check for numeric attribute range filtering (e.g. >= 16 or <= 5)
            WHEN ca.attribute_type = 'number' AND f.value ~ '^>=\s*-?[0-9]+(\.[0-9]+)?$' THEN
              (pa.attribute_value#>>'{}')::numeric >= (substring(f.value from '>=?\s*(-?[0-9]+(\.[0-9]+)?)'))::numeric
            WHEN ca.attribute_type = 'number' AND f.value ~ '^>\s*-?[0-9]+(\.[0-9]+)?$' THEN
              (pa.attribute_value#>>'{}')::numeric > (substring(f.value from '>?\s*(-?[0-9]+(\.[0-9]+)?)'))::numeric
            WHEN ca.attribute_type = 'number' AND f.value ~ '^<=\s*-?[0-9]+(\.[0-9]+)?$' THEN
              (pa.attribute_value#>>'{}')::numeric <= (substring(f.value from '<=?\s*(-?[0-9]+(\.[0-9]+)?)'))::numeric
            WHEN ca.attribute_type = 'number' AND f.value ~ '^<\s*-?[0-9]+(\.[0-9]+)?$' THEN
              (pa.attribute_value#>>'{}')::numeric < (substring(f.value from '<?\s*(-?[0-9]+(\.[0-9]+)?)'))::numeric
            -- Otherwise use standard exact string match
            ELSE 
              pa.attribute_value#>>'{}' = f.value
          END
        )
    ) = filter_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_products_by_attributes(JSONB) TO anon, authenticated, service_role;


-- ============================================================
-- 4. ONE-TIME DATA CLEANUP & BACKFILLS
-- ============================================================

-- Clean up any legacy product attributes that don't match product category or subcategory
DELETE FROM public.product_attributes pa
USING public.category_attributes ca, public.products p
WHERE pa.product_id = p.id
  AND pa.attribute_id = ca.id
  AND ca.category_id IS DISTINCT FROM p.category_id
  AND ca.category_id IS DISTINCT FROM p.subcategory_id;

-- Backfill subcategory_id for products where subcategory text was set and maps to a subcategory slug
UPDATE public.products p
SET subcategory_id = pc.id
FROM public.product_categories pc
WHERE p.subcategory_id IS NULL 
  AND p.subcategory = pc.slug 
  AND pc.parent_id IS NOT NULL;
