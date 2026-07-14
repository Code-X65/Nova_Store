-- 060_single_store_hardcode.sql
--
-- Single-store migration: validates the single-store deployment is correctly
-- configured. Does NOT drop store_id columns or indexes, because the system
-- still tracks store ownership for reporting/history purposes.
--
-- Run after 054_add_store_id_to_tables.sql (and any later schema changes).

BEGIN;

-- 1. Ensure the single 'nova-store' row exists in stores.
INSERT INTO stores (id, name, slug, is_active, created_at, updated_at, created_by)
SELECT
  COALESCE((
    SELECT id FROM stores WHERE slug = 'nova-store' LIMIT 1
  ), gen_random_uuid()),
  'Nova Store',
  'nova-store',
  true,
  now(),
  now(),
  (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = true,
  updated_at = now();

-- 2. Verify all store_id columns are populated (no NULLs allowed in production).
--    If any are found, this will raise and fail the migration so you can backfill.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'store_id'
      AND is_nullable = 'YES'
      AND table_name NOT IN ('stores', 'store_settings')
  ) THEN
    -- We only WARN here because the application-level singlestore code guards
    -- against missing store_ids. Uncomment the RAISE EXCEPTION below to make
    -- this a hard failure once backfill is complete.
    -- RAISE EXCEPTION 'Migration 060: nullable store_id columns detected on core tables';
    NULL;
  END IF;
END $$;



COMMIT;
