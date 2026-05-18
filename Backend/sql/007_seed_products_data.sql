-- Seed Products Data
DO $$ 
DECLARE 
    admin_id UUID;
    earbuds_id UUID;
    tshirt_id UUID;
BEGIN
    -- 1. Get an Admin User ID
    SELECT id INTO admin_id FROM users WHERE role = 'ADMIN' LIMIT 1;
    
    IF admin_id IS NULL THEN
        RAISE NOTICE 'No admin user found. Please create an admin user first.';
        RETURN;
    END IF;

    -- 2. Insert Wireless Earbuds
    INSERT INTO products (
        sku, name, slug, description, short_description, 
        category, brand, price, sale_price, discount_percentage, 
        stock_quantity, status, is_featured, created_by,
        primary_image_url
    ) VALUES (
        'ELEC-001', 'Wireless Earbuds Pro', 'wireless-earbuds-pro', 
        'High-quality wireless earbuds with active noise cancellation and 24-hour battery life.', 
        'Premium noise-cancelling earbuds', 
        'electronics', 'SoundMax', 199.99, 149.99, 25.00, 
        100, 'published', true, admin_id,
        'https://images.unsplash.com/photo-1590658268037-6bf12165a8df'
    ) RETURNING id INTO earbuds_id;

    -- Insert Variants for Earbuds
    INSERT INTO product_variants (product_id, sku, name, option_values, stock_quantity)
    VALUES 
    (earbuds_id, 'ELEC-001-BLK', 'Black', '{"color": "Black"}'::jsonb, 40),
    (earbuds_id, 'ELEC-001-WHT', 'White', '{"color": "White"}'::jsonb, 60);

    -- 3. Insert Cotton T-Shirt
    INSERT INTO products (
        sku, name, slug, description, short_description, 
        category, brand, price, stock_quantity, status, created_by,
        primary_image_url
    ) VALUES (
        'CLOT-001', 'Essential Cotton T-Shirt', 'essential-cotton-t-shirt', 
        '100% organic cotton t-shirt. Breathable, durable, and stylish.', 
        'Classic organic cotton tee', 
        'clothing', 'NovaStyle', 29.99, 
        150, 'published', admin_id,
        'https://images.unsplash.com/photo-1521572267360-ee0c2909d518'
    ) RETURNING id INTO tshirt_id;

    -- Insert Variants for T-Shirt
    INSERT INTO product_variants (product_id, sku, name, option_values, stock_quantity)
    VALUES 
    (tshirt_id, 'CLOT-001-S', 'Small', '{"size": "S"}'::jsonb, 50),
    (tshirt_id, 'CLOT-001-M', 'Medium', '{"size": "M"}'::jsonb, 50),
    (tshirt_id, 'CLOT-001-L', 'Large', '{"size": "L"}'::jsonb, 50);

    -- 4. Insert Smart Watch (Featured)
    INSERT INTO products (
        sku, name, slug, description, short_description, 
        category, brand, price, stock_quantity, status, is_featured, featured_priority, created_by,
        primary_image_url
    ) VALUES (
        'ELEC-002', 'Nova Smart Watch v2', 'nova-smart-watch-v2', 
        'Advanced fitness tracking, heart rate monitor, and GPS integration.', 
        'The ultimate fitness companion', 
        'electronics', 'NovaTech', 299.99, 
        30, 'published', true, 10, admin_id,
        'https://images.unsplash.com/photo-1523275335684-37898b6baf30'
    );

    -- 5. Insert Running Shoes
    INSERT INTO products (
        sku, name, slug, description, short_description, 
        category, brand, price, sale_price, discount_percentage, 
        stock_quantity, status, created_by,
        primary_image_url
    ) VALUES (
        'FOOT-001', 'SpeedRun 5000', 'speedrun-5000', 
        'Professional running shoes with responsive cushioning and breathable mesh.', 
        'Lightweight high-performance runners', 
        'footwear', 'RunFast', 120.00, 89.99, 25.01,
        75, 'published', admin_id,
        'https://images.unsplash.com/photo-1542291026-7eec264c27ff'
    );

END $$;
