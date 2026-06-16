-- ============================================================
-- Migration: 032_category_attributes.sql
-- Dynamic, category-specific product attribute templates
-- ============================================================

-- 1. Attribute template definitions per category
CREATE TABLE IF NOT EXISTS public.category_attributes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id      UUID NOT NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,

  attribute_name   TEXT NOT NULL,           -- e.g. "RAM", "Storage", "Capacity"
  attribute_type   TEXT NOT NULL DEFAULT 'text'
                   CHECK (attribute_type IN ('text', 'number', 'boolean', 'enum')),

  is_required      BOOLEAN NOT NULL DEFAULT FALSE,
  unit             TEXT,                    -- e.g. "GB", "kg", "L" (optional, display only)
  allowed_values   TEXT[],                  -- Non-null only when attribute_type = 'enum'
  display_order    INT NOT NULL DEFAULT 0,  -- Controls render order in the UI

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One attribute name per category (case-insensitive enforced at app level)
  UNIQUE (category_id, attribute_name)
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_category_attributes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_category_attributes_updated_at ON public.category_attributes;
CREATE TRIGGER trg_category_attributes_updated_at
  BEFORE UPDATE ON public.category_attributes
  FOR EACH ROW EXECUTE FUNCTION public.set_category_attributes_updated_at();


-- 2. Product attribute values
CREATE TABLE IF NOT EXISTS public.product_attributes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  attribute_id     UUID NOT NULL REFERENCES public.category_attributes(id) ON DELETE CASCADE,
  attribute_value  TEXT NOT NULL,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One value per attribute per product
  UNIQUE (product_id, attribute_id)
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_product_attributes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_attributes_updated_at ON public.product_attributes;
CREATE TRIGGER trg_product_attributes_updated_at
  BEFORE UPDATE ON public.product_attributes
  FOR EACH ROW EXECUTE FUNCTION public.set_product_attributes_updated_at();


-- Indexes
CREATE INDEX IF NOT EXISTS idx_category_attributes_category  ON public.category_attributes(category_id);
CREATE INDEX IF NOT EXISTS idx_product_attributes_product    ON public.product_attributes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_attributes_attribute  ON public.product_attributes(attribute_id);

-- Disable RLS (backend-managed access control)
ALTER TABLE public.category_attributes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_attributes  DISABLE ROW LEVEL SECURITY;
