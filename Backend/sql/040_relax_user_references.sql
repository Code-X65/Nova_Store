-- ============================================================
-- Migration: 040_relax_user_references.sql
-- Relax foreign keys referencing the public.users table for admin-created objects,
-- allowing UUIDs from public.admins (separate table) as well.
-- ============================================================

-- 1. Product Categories
ALTER TABLE public.product_categories DROP CONSTRAINT IF EXISTS product_categories_created_by_fkey;
ALTER TABLE public.product_categories DROP CONSTRAINT IF EXISTS product_categories_updated_by_fkey;

-- 2. Product Brands
ALTER TABLE public.product_brands DROP CONSTRAINT IF EXISTS product_brands_created_by_fkey;
ALTER TABLE public.product_brands DROP CONSTRAINT IF EXISTS product_brands_updated_by_fkey;

-- 3. Products
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_created_by_fkey;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_updated_by_fkey;

-- 4. Inventory Transactions
ALTER TABLE public.inventory_transactions DROP CONSTRAINT IF EXISTS inventory_transactions_performed_by_fkey;

-- 5. Review Reports
ALTER TABLE public.review_reports DROP CONSTRAINT IF EXISTS review_reports_resolved_by_fkey;

-- 6. Setting History
ALTER TABLE public.setting_history DROP CONSTRAINT IF EXISTS setting_history_changed_by_fkey;

-- 7. Order Status History
ALTER TABLE public.order_status_history DROP CONSTRAINT IF EXISTS order_status_history_changed_by_fkey;

-- 8. Audit Logs
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;

-- 9. User Roles
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_granted_by_fkey;
