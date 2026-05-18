-- 1. Products Table
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,                    -- Stock Keeping Unit
  name TEXT NOT NULL,                          -- Product display name
  slug TEXT UNIQUE NOT NULL,                   -- URL-friendly name
  description TEXT,                            -- Full product description
  short_description TEXT,                      -- Brief summary (for cards/lists)
  
  -- Category & Taxonomy
  category TEXT NOT NULL,                      -- e.g., 'electronics', 'clothing'
  subcategory TEXT,
  tags TEXT[] DEFAULT '{}',                    -- Array of tags for search/filter
  brand TEXT,
  
  -- Pricing
  price DECIMAL(10,2) NOT NULL,                -- Base price
  sale_price DECIMAL(10,2),                    -- Optional discounted price
  discount_percentage DECIMAL(5,2),            -- auto-calculated or manual
  cost_price DECIMAL(10,2),                    -- For profit calculations (admin only)
  
  -- Inventory
  stock_quantity INT DEFAULT 0,
  low_stock_threshold INT DEFAULT 10,
  track_inventory BOOLEAN DEFAULT TRUE,
  allow_backorder BOOLEAN DEFAULT FALSE,
  
  -- Physical Attributes
  weight DECIMAL(8,3),                         -- in kg
  dimensions JSONB DEFAULT '{"length":0,"width":0,"height":0}', -- in cm
  weight_unit TEXT DEFAULT 'kg',
  
  -- Status & Visibility
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived', 'out_of_stock')),
  is_featured BOOLEAN DEFAULT FALSE,           -- Show on homepage/featured section
  featured_priority INT DEFAULT 0,             -- Higher = more prominent placement
  
  -- SEO
  meta_title TEXT,
  meta_description TEXT,
  meta_keywords TEXT[],
  
  -- Relationships
  created_by UUID NOT NULL REFERENCES users(id), -- Admin who created product
  updated_by UUID REFERENCES users(id),          -- Last editor
  
  -- Media
  primary_image_url TEXT,                      -- Thumbnail/cover image
  image_gallery TEXT[] DEFAULT '{}',          -- Array of image URLs
  
  -- Timestamps
  published_at TIMESTAMP WITH TIME ZONE,       -- When status changed to 'published'
  archived_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,         -- Soft delete marker
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Product Variants Table
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  -- Variant Identification
  sku TEXT UNIQUE NOT NULL,                    -- Unique per variant
  name TEXT NOT NULL,                          -- e.g., "Large / Red"
  option_values JSONB NOT NULL,                -- {"size": "L", "color": "Red"}
  
  -- Pricing Override (optional)
  price_modifier DECIMAL(10,2) DEFAULT 0,      -- Additional cost (+ or -) from base price
  sale_price DECIMAL(10,2),                    -- Override sale price
  
  -- Inventory
  stock_quantity INT DEFAULT 0,
  track_inventory BOOLEAN DEFAULT TRUE,
  
  -- Media
  image_url TEXT,                              -- Variant-specific image
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Inventory Transactions Table
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('sale', 'restock', 'adjustment', 'return', 'reservation')),
  quantity_change INT NOT NULL,
  previous_quantity INT NOT NULL,
  new_quantity INT NOT NULL,
  reference_id UUID,                           -- e.g., order_id, return_id
  notes TEXT,
  performed_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON products(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_sku ON product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_product ON inventory_transactions(product_id);

-- Disable RLS for backend management
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions DISABLE ROW LEVEL SECURITY;
