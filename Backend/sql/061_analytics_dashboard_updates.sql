-- 061_analytics_dashboard_updates.sql

-- 1. Create Get Sales By Category function
CREATE OR REPLACE FUNCTION get_sales_by_category(start_date TIMESTAMPTZ, end_date TIMESTAMPTZ)
RETURNS TABLE (
    category_name TEXT,
    revenue NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(c.name, 'Uncategorized') AS category_name,
        COALESCE(SUM(oi.unit_price * oi.quantity), 0) AS revenue
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN products p ON oi.product_id = p.id
    LEFT JOIN product_categories c ON p.category_id = c.id
    WHERE o.created_at >= start_date AND o.created_at <= end_date
    AND o.status NOT IN ('cancelled', 'refunded')
    GROUP BY c.name
    ORDER BY revenue DESC;
END;
$$ LANGUAGE plpgsql;

-- 2. Update Get Best Sellers function
DROP FUNCTION IF EXISTS get_best_sellers(timestamp, timestamp, integer, text, uuid);
DROP FUNCTION IF EXISTS get_best_sellers(timestamp with time zone, timestamp with time zone, integer, text, uuid);

CREATE OR REPLACE FUNCTION get_best_sellers(start_date TIMESTAMPTZ, end_date TIMESTAMPTZ, top_limit INT, sort_by TEXT, cat_id UUID DEFAULT NULL)
RETURNS TABLE (
    product_id UUID,
    product_name TEXT,
    primary_image_url TEXT,
    thumbnail_url TEXT,
    category_name TEXT,
    quantity_sold BIGINT,
    revenue NUMERIC,
    stock_quantity INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id AS product_id,
        p.name AS product_name,
        p.primary_image_url,
        p.thumbnail_url,
        c.name AS category_name,
        COALESCE(SUM(oi.quantity), 0)::BIGINT AS quantity_sold,
        COALESCE(SUM(oi.unit_price * oi.quantity), 0) AS revenue,
        p.stock_quantity
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN products p ON oi.product_id = p.id
    LEFT JOIN product_categories c ON p.category_id = c.id
    WHERE o.created_at >= start_date AND o.created_at <= end_date
    AND o.status NOT IN ('cancelled', 'refunded')
    AND (cat_id IS NULL OR p.category_id = cat_id)
    GROUP BY p.id, p.name, p.primary_image_url, p.thumbnail_url, c.name, p.stock_quantity
    ORDER BY 
        CASE WHEN sort_by = 'revenue' THEN COALESCE(SUM(oi.unit_price * oi.quantity), 0) END DESC,
        CASE WHEN sort_by = 'quantity' THEN COALESCE(SUM(oi.quantity), 0) END DESC
    LIMIT top_limit;
END;
$$ LANGUAGE plpgsql;
