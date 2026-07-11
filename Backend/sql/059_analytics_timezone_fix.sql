-- Drop old signatures to avoid overloads
DROP FUNCTION IF EXISTS get_sales_summary(timestamp, timestamp, text);
DROP FUNCTION IF EXISTS get_best_sellers(timestamp, timestamp, integer, text, uuid);
DROP FUNCTION IF EXISTS get_user_growth(timestamp, timestamp, text);

-- 1. Get Sales Summary (Revenue over time)
-- Groups by day, week, month, or year
CREATE OR REPLACE FUNCTION get_sales_summary(start_date TIMESTAMPTZ, end_date TIMESTAMPTZ, group_period TEXT)
RETURNS TABLE (
    period TIMESTAMPTZ,
    revenue NUMERIC,
    orders BIGINT,
    average_order_value NUMERIC,
    items_sold BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE_TRUNC(group_period, o.created_at) AS period,
        COALESCE(SUM(o.total_amount), 0) AS revenue,
        COUNT(o.id) AS orders,
        COALESCE(AVG(o.total_amount), 0) AS average_order_value,
        COALESCE(SUM(oi.total_items), 0)::BIGINT AS items_sold
    FROM orders o
    LEFT JOIN (
        SELECT order_id, SUM(quantity) as total_items FROM order_items GROUP BY order_id
    ) oi ON o.id = o.id
    WHERE o.created_at >= start_date AND o.created_at <= end_date
    AND o.status NOT IN ('cancelled', 'refunded')
    GROUP BY DATE_TRUNC(group_period, o.created_at)
    ORDER BY period;
END;
$$ LANGUAGE plpgsql;

-- 2. Get Best Sellers
CREATE OR REPLACE FUNCTION get_best_sellers(start_date TIMESTAMPTZ, end_date TIMESTAMPTZ, top_limit INT, sort_by TEXT, cat_id UUID DEFAULT NULL)
RETURNS TABLE (
    product_id UUID,
    product_name TEXT,
    category_name TEXT,
    quantity_sold BIGINT,
    revenue NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id AS product_id,
        p.name AS product_name,
        c.name AS category_name,
        COALESCE(SUM(oi.quantity), 0)::BIGINT AS quantity_sold,
        COALESCE(SUM(oi.unit_price * oi.quantity), 0) AS revenue
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN products p ON oi.product_id = p.id
    LEFT JOIN product_categories c ON p.category_id = c.id
    WHERE o.created_at >= start_date AND o.created_at <= end_date
    AND o.status NOT IN ('cancelled', 'refunded')
    AND (cat_id IS NULL OR p.category_id = cat_id)
    GROUP BY p.id, p.name, c.name
    ORDER BY 
        CASE WHEN sort_by = 'revenue' THEN COALESCE(SUM(oi.unit_price * oi.quantity), 0) END DESC,
        CASE WHEN sort_by = 'quantity' THEN COALESCE(SUM(oi.quantity), 0) END DESC
    LIMIT top_limit;
END;
$$ LANGUAGE plpgsql;

-- 3. Get User Growth
CREATE OR REPLACE FUNCTION get_user_growth(start_date TIMESTAMPTZ, end_date TIMESTAMPTZ, group_period TEXT)
RETURNS TABLE (
    period TIMESTAMPTZ,
    new_users BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE_TRUNC(group_period, created_at) AS period,
        COUNT(id) AS new_users
    FROM users
    WHERE created_at >= start_date AND created_at <= end_date
    GROUP BY DATE_TRUNC(group_period, created_at)
    ORDER BY period;
END;
$$ LANGUAGE plpgsql;
