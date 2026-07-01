-- Drop old GIN index
DROP INDEX IF EXISTS idx_products_fts;

-- Recreate FTS GIN index with COALESCE to handle NULL values safely
CREATE INDEX IF NOT EXISTS idx_products_fts ON products USING gin(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '')));

-- Recreate search_products function using COALESCE for robust description search
CREATE OR REPLACE FUNCTION search_products(search_query TEXT, lim INT DEFAULT 10)
RETURNS SETOF products AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM products
  WHERE to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '')) @@ websearch_to_tsquery('english', search_query)
     AND deleted_at IS NULL
  ORDER BY ts_rank(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '')), websearch_to_tsquery('english', search_query)) DESC
  LIMIT lim;
END;
$$ LANGUAGE plpgsql;
