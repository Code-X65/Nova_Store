-- 058_manager_permissions_fix.sql
-- Fixes missing permissions for the MANAGER role that are required by the frontend Admin routes.

DO $$
DECLARE
  v_manager_role_id UUID;
BEGIN
  -- Get the MANAGER role ID
  SELECT id INTO v_manager_role_id FROM roles WHERE name = 'MANAGER';
  
  IF v_manager_role_id IS NULL THEN
    RAISE NOTICE 'MANAGER role not found, skipping migration.';
    RETURN;
  END IF;

  -- Insert the missing permissions to MANAGER
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_manager_role_id, p.id
  FROM permissions p
  WHERE p.key IN (
    'category:read', 'category:write', 'category:create',
    'brand:read', 'brand:write', 'brand:create',
    'analytics:read',
    'settings:read', 'settings:write',
    'shipping:read', 'shipping:write',
    'review:read', 'review:write',
    'audit:read',
    'coupon:create', 'coupon:write', 'coupon:delete', 'coupon:read',
    'notification:read', 'notification:write'
  )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Permissions updated for MANAGER.';
END;
$$;
