-- Migration 049: Add color column to products and product_categories
-- Run this on your Supabase SQL editor or via psql.
-- Both columns are nullable TEXT — no data migration required.

-- Add color to products table (first-class color field for simple products
-- without variants; variant-level color still lives in product_variants.option_values)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS color TEXT;

-- Add color to product_categories table (used for UI badges, filter chips, etc.)
ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS color TEXT;

-- Add weight and flat dimension columns to products (for shipping calculations)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS weight NUMERIC(10, 3);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS dimensions_length NUMERIC(10, 2);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS dimensions_width NUMERIC(10, 2);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS dimensions_height NUMERIC(10, 2);

-- Add cost_price for profit-margin analytics
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12, 2);

-- Add inventory behaviour flags
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS allow_backorder BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN NOT NULL DEFAULT true;

-- Add tags (stored as a TEXT array)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS tags TEXT[];
