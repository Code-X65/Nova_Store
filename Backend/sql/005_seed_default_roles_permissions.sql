-- Seed Default Roles
INSERT INTO roles (name, display_name, description, color_code, is_system, is_default)
VALUES 
('admin', 'Administrator', 'Full system access', '#DC2626', true, false),
('moderator', 'Moderator', 'Moderate content and users', '#D97706', true, false),
('customer', 'Customer', 'Regular user access', '#2563EB', true, true)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description;

-- Seed Default Permissions
INSERT INTO permissions (key, name, description, category)
VALUES 
-- User Management
('user:read', 'Read User', 'View user profiles', 'users'),
('user:write', 'Write User', 'Update user profiles', 'users'),
('user:delete', 'Delete User', 'Delete user accounts', 'users'),
-- Role Management
('role:manage', 'Manage Roles', 'Create, update, and delete roles', 'roles'),
('permission:assign', 'Assign Permissions', 'Assign permissions to roles', 'roles'),
-- Product Management
('product:create', 'Create Product', 'Add new products to the store', 'products'),
('product:write', 'Edit Product', 'Update existing product details', 'products'),
('product:delete', 'Delete Product', 'Remove products from the store', 'products'),
-- Order Management
('order:read', 'Read Orders', 'View customer orders', 'orders'),
('order:write', 'Manage Orders', 'Update order status and details', 'orders'),
-- Inventory Management
('inventory:read', 'Read Inventory', 'View stock levels and transaction history', 'inventory'),
('inventory:write', 'Manage Stock', 'Add, reduce or adjust product stock levels', 'inventory'),
('inventory:alert', 'Manage Alerts', 'Configure low stock notification settings', 'inventory'),
-- Administrative
('admin:access', 'Admin Access', 'Access the administrative dashboard', 'admin'),
('onboarding:manage', 'Manage Onboarding', 'Edit onboarding questions and flow', 'admin'),
-- Special
('*', 'Super Admin', 'Unrestricted access to all resources', 'system')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- Assign All Permissions to Admin Role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- Assign Limited Permissions to Moderator Role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'moderator' 
AND p.key IN ('user:read', 'product:write', 'order:read', 'order:write', 'admin:access')
ON CONFLICT DO NOTHING;

-- Assign Basic Permissions to Customer Role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'customer' 
AND p.key IN ('user:read') -- Regular users only read their own, handled by ownership middleware
ON CONFLICT DO NOTHING;
