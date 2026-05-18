-- Seed admin user
-- Password:Admin@123 (bcrypt cost 12)
INSERT INTO users (
  email, password_hash, first_name, last_name, is_active, is_email_verified, role, created_at
) VALUES (
  'admin@novastore.com',
  '$2b$12$KIX5eHvB1pJWDBhMWTqOUOvEhRXnNHmJBYnHRyDLHd9ZBWqVRgrjC', -- Admin@123
  'Nova',
  'Administrator',
  true,
  true,
  'ADMIN',
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Assign admin role to admin user
DO $$
DECLARE
  v_user_id  UUID;
  v_role_id  UUID;
BEGIN
  SELECT id INTO v_user_id  FROM users  WHERE email = 'admin@novastore.com';
  SELECT id INTO v_role_id  FROM roles   WHERE name  = 'admin';
  IF v_user_id IS NOT NULL AND v_role_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id, granted_by, granted_at)
    VALUES (v_user_id, v_role_id, v_user_id, NOW())
    ON CONFLICT (user_id, role_id) DO NOTHING;
  END IF;
END $$;
