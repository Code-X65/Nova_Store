-- Currency
INSERT INTO settings (key, value, value_type, description, group_name, is_public) VALUES
('currency.default', 'USD', 'string', 'Default store currency', 'currency', true),
('currency.symbol', '$', 'string', 'Currency symbol', 'currency', true),
('currency.position', 'prefix', 'string', 'Symbol position: prefix or suffix', 'currency', true),
('currency.decimal_places', '2', 'number', 'Number of decimal places', 'currency', true)
ON CONFLICT (key) DO NOTHING;

-- Tax
INSERT INTO settings (key, value, value_type, description, group_name, is_public) VALUES
('tax.default_rate', '7.5', 'number', 'Default tax/VAT rate (%)', 'tax', true),
('tax.inclusive', 'false', 'boolean', 'Are prices tax-inclusive?', 'tax', true),
('tax.shipping_taxable', 'true', 'boolean', 'Is shipping subject to tax?', 'tax', true)
ON CONFLICT (key) DO NOTHING;

-- Shipping
INSERT INTO settings (key, value, value_type, description, group_name, is_public) VALUES
('shipping.free_shipping_threshold', '100', 'number', 'Minimum order amount for free shipping (in default currency)', 'shipping', true),
('shipping.default_carrier', 'standard', 'string', 'Default shipping method', 'shipping', true),
('shipping.restrict_countries', 'false', 'boolean', 'Only ship to allowed countries', 'shipping', true),
('shipping.allowed_countries', '["US","NG","GB"]', 'json', 'List of allowed shipping countries', 'shipping', true)
ON CONFLICT (key) DO NOTHING;

-- Store Info
INSERT INTO settings (key, value, value_type, description, group_name, is_public) VALUES
('store.name', 'Nova Store', 'string', 'Store display name', 'store', true),
('store.email', 'support@novastore.com', 'string', 'Customer support email', 'store', true),
('store.phone', '+1234567890', 'string', 'Customer support phone', 'store', true),
('store.address', '123 Main St, City, Country', 'string', 'Physical store address', 'store', false),
('store.logo_url', '/assets/logo.png', 'string', 'Store logo image URL', 'store', true),
('store.timezone', 'UTC', 'string', 'Store timezone for order dates', 'store', false)
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
