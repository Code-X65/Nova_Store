-- Create user search logs table
CREATE TABLE IF NOT EXISTS user_search_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    search_query TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create user product views table
CREATE TABLE IF NOT EXISTS user_product_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    view_duration INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_search_logs_user_id ON user_search_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_search_logs_created_at ON user_search_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_product_views_user_id ON user_product_views(user_id);
CREATE INDEX IF NOT EXISTS idx_user_product_views_product_id ON user_product_views(product_id);
CREATE INDEX IF NOT EXISTS idx_user_product_views_created_at ON user_product_views(created_at DESC);

-- Disable Row Level Security to match wishlist/coupon/review logs pattern
ALTER TABLE user_search_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_product_views DISABLE ROW LEVEL SECURITY;
