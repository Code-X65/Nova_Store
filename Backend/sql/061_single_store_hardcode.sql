-- 061_single_store_hardcode.sql

DO $$
DECLARE
  v_old_store_id UUID;
  v_super_admin_id UUID;
BEGIN
  SELECT id INTO v_old_store_id FROM stores WHERE slug = 'nova-store';
  
  -- If it already has the correct ID, do nothing.
  IF v_old_store_id = '11111111-1111-1111-1111-111111111111'::uuid THEN
    RETURN;
  END IF;

  -- Change the old slug temporarily to avoid unique constraint on slug
  IF v_old_store_id IS NOT NULL THEN
    UPDATE stores SET slug = 'nova-store-old' WHERE id = v_old_store_id;
  END IF;

  -- Get super admin to use as created_by
  SELECT id INTO v_super_admin_id FROM users WHERE email = 'admin@novastore.com' LIMIT 1;
  IF v_super_admin_id IS NULL THEN
    -- Fallback to any super admin if email changed
    SELECT id INTO v_super_admin_id FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1;
  END IF;

  -- Insert the new store with the exact required UUID
  INSERT INTO stores (
    id, name, slug, tagline, description, email, address, business_type, timezone, currency, country, language, is_active, return_window_days, created_by
  )
  VALUES (
    '11111111-1111-1111-1111-111111111111', 
    'Nova Store', 
    'nova-store', 
    'Shop smarter. Shop Nova.', 
    'Nova Store is your one-stop destination for quality products at great prices.', 
    'admin@novastore.com', 
    '{"street": "", "city": "Lagos", "state": "Lagos", "country": "Nigeria", "postal_code": ""}'::jsonb, 
    'retail', 
    'Africa/Lagos', 
    'NGN', 
    'Nigeria', 
    'en', 
    TRUE, 
    7, 
    v_super_admin_id
  ) ON CONFLICT (id) DO NOTHING;

  -- Copy over settings before updating relationships
  IF v_old_store_id IS NOT NULL THEN
    INSERT INTO store_settings (store_id, key, value, created_at, updated_at)
    SELECT '11111111-1111-1111-1111-111111111111', key, value, created_at, updated_at 
    FROM store_settings 
    WHERE store_id = v_old_store_id
    ON CONFLICT (store_id, key) DO NOTHING;
  END IF;

  -- Now update all FK references
  UPDATE users SET store_id = '11111111-1111-1111-1111-111111111111' WHERE store_id = v_old_store_id OR (store_id IS NULL AND role IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR'));
  UPDATE products SET store_id = '11111111-1111-1111-1111-111111111111' WHERE store_id = v_old_store_id OR store_id IS NULL;
  UPDATE product_categories SET store_id = '11111111-1111-1111-1111-111111111111' WHERE store_id = v_old_store_id OR store_id IS NULL;
  UPDATE product_brands SET store_id = '11111111-1111-1111-1111-111111111111' WHERE store_id = v_old_store_id OR store_id IS NULL;
  UPDATE orders SET store_id = '11111111-1111-1111-1111-111111111111' WHERE store_id = v_old_store_id OR store_id IS NULL;
  UPDATE carts SET store_id = '11111111-1111-1111-1111-111111111111' WHERE store_id = v_old_store_id OR store_id IS NULL;
  UPDATE wishlists SET store_id = '11111111-1111-1111-1111-111111111111' WHERE store_id = v_old_store_id OR store_id IS NULL;
  UPDATE coupons SET store_id = '11111111-1111-1111-1111-111111111111' WHERE store_id = v_old_store_id OR store_id IS NULL;
  UPDATE inventory_transactions SET store_id = '11111111-1111-1111-1111-111111111111' WHERE store_id = v_old_store_id OR store_id IS NULL;
  UPDATE inventory_reservations SET store_id = '11111111-1111-1111-1111-111111111111' WHERE store_id = v_old_store_id OR store_id IS NULL;
  UPDATE invitations SET store_id = '11111111-1111-1111-1111-111111111111' WHERE store_id = v_old_store_id OR store_id IS NULL;

  -- Try to update any other tables like reviews or attributes if they exist and have a store_id column.
  -- To be safe from missing tables, we do it in EXCEPTION blocks if they don't exist.
  BEGIN
    EXECUTE 'UPDATE attributes SET store_id = ''11111111-1111-1111-1111-111111111111'' WHERE store_id = $1 OR store_id IS NULL' USING v_old_store_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN END;

  BEGIN
    EXECUTE 'UPDATE reviews SET store_id = ''11111111-1111-1111-1111-111111111111'' WHERE store_id = $1 OR store_id IS NULL' USING v_old_store_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN END;

  -- Delete the old store
  IF v_old_store_id IS NOT NULL THEN
    DELETE FROM stores WHERE id = v_old_store_id;
  END IF;
  
END;
$$;
