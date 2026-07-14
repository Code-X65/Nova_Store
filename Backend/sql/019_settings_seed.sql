-- Currency (NGN-only — single-vendor Nigerian store)
INSERT INTO settings (key, value, value_type, description, group_name, is_public) VALUES
('currency.default', 'NGN', 'string', 'Default store currency (immutable — NGN only)', 'currency', true),
('currency.symbol', '₦', 'string', 'Currency symbol', 'currency', true),
('currency.position', 'prefix', 'string', 'Symbol position: prefix or suffix', 'currency', true),
('currency.decimal_places', '2', 'number', 'Number of decimal places (kobo)', 'currency', true)
ON CONFLICT (key) DO NOTHING;

-- Tax (removed from scope — no tax engine)
-- No tax settings seeded; legacy rows may exist and can be removed manually if desired.

-- Shipping
INSERT INTO settings (key, value, value_type, description, group_name, is_public) VALUES
('shipping.free_shipping_threshold', '100', 'number', 'Minimum order amount for free shipping (in NGN)', 'shipping', true),
('shipping.default_carrier', 'standard', 'string', 'Default shipping method', 'shipping', true),
('shipping.restrict_countries', 'false', 'boolean', 'Only ship to allowed countries', 'shipping', true),
('shipping.allowed_countries', '["NG"]', 'json', 'List of allowed shipping countries (NGN-only store)', 'shipping', true)
ON CONFLICT (key) DO NOTHING;

-- Localization (operational only — no i18n)
INSERT INTO settings (key, value, value_type, description, group_name, is_public) VALUES
('localization.store_timezone', 'Africa/Lagos', 'string', 'Store timezone (IANA tz database)', 'localization', false),
('localization.date_format', 'dd/MM/yyyy', 'string', 'Date display format (dayjs-compatible)', 'localization', true)
ON CONFLICT (key) DO NOTHING;

-- Store Info
INSERT INTO settings (key, value, value_type, description, group_name, is_public) VALUES
('store.name', 'Nova Store', 'string', 'Store display name', 'store', true),
('store.email', 'support@novastore.com', 'string', 'Customer support email', 'store', true),
('store.phone', '+2348000000000', 'string', 'Customer support phone', 'store', true),
('store.address', 'Lagos, Nigeria', 'string', 'Physical store address', 'store', false),
('store.logo_url', '/assets/logo.png', 'string', 'Store logo image URL', 'store', true),
('store.timezone', 'Africa/Lagos', 'string', 'Store timezone for order dates (redundant with localization.store_timezone)', 'store', false)
ON CONFLICT (key) DO NOTHING;

-- SEO
INSERT INTO settings (key, value, value_type, description, group_name, is_public) VALUES
('seo.meta_title', 'Nova Store — Shop Online', 'string', 'Default store meta title', 'seo', true),
('seo.meta_description', 'Your one-stop shop for quality products in Nigeria.', 'string', 'Default store meta description', 'seo', true),
('seo.robots_txt', 'User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: https://novastore.com/sitemap.xml', 'string', 'robots.txt content', 'seo', true),
('seo.sitemap_enabled', 'true', 'boolean', 'Enable XML sitemap generation', 'seo', true),
('seo.json_ld_enabled', 'true', 'boolean', 'Enable JSON-LD structured data injection', 'seo', true)
ON CONFLICT (key) DO NOTHING;

-- Email
INSERT INTO settings (key, value, value_type, description, group_name, is_public) VALUES
('email.from_name', 'Nova Store', 'string', 'Sender name for emails', 'email', false),
('email.from_address', 'noreply@novastore.com', 'string', 'Sender email address', 'email', false),
('email.reply_to', 'support@novastore.com', 'string', 'Reply-to email', 'email', false)
ON CONFLICT (key) DO NOTHING;

-- Maintenance
INSERT INTO settings (key, value, value_type, description, group_name, is_public) VALUES
('maintenance_mode', 'false', 'boolean', 'Put site into maintenance mode', 'system', false),
('maintenance_message', 'We are performing maintenance. Please check back soon.', 'string', 'Maintenance banner message', 'system', false)
ON CONFLICT (key) DO NOTHING;
