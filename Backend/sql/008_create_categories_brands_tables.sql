-- 1. Product Categories Table
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,                          -- e.g., "Electronics"
  slug TEXT UNIQUE NOT NULL,                   -- e.g., "electronics"
  description TEXT,
  
  -- Hierarchy
  parent_id UUID REFERENCES product_categories(id) ON DELETE CASCADE, -- NULL for root
  level INT DEFAULT 0,                         -- Depth: 0=root, 1=child
  full_path TEXT[] DEFAULT '{}',              -- Array of ancestor slugs
  sort_order INT DEFAULT 0,                    -- Manual ordering
  
  -- Media
  image_url TEXT,                              -- Category thumbnail
  icon TEXT,                                   -- Icon class or URL
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,           -- Featured in navigation
  
  -- Tracking
  product_count INT DEFAULT 0,                 -- Cached count
  
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Product Brands Table
CREATE TABLE IF NOT EXISTS product_brands (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,                   -- e.g., "Apple"
  slug TEXT UNIQUE NOT NULL,                   -- e.g., "apple"
  description TEXT,
  
  -- Media
  logo_url TEXT,                               -- Brand logo
  banner_url TEXT,                             -- Brand banner
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,           -- Featured brands
  
  -- Tracking
  product_count INT DEFAULT 0,                 -- Cached count
  
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Product Category Assignments (Many-to-Many)
CREATE TABLE IF NOT EXISTS product_category_assignments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  UNIQUE(product_id, category_id)
);

-- 4. Update Products Table for Brands
ALTER TABLE products ADD COLUMN brand_id UUID REFERENCES product_brands(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_categories_parent ON product_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON product_categories(slug);
CREATE INDEX IF NOT EXISTS idx_brands_slug ON product_brands(slug);
CREATE INDEX IF NOT EXISTS idx_category_assignments_product ON product_category_assignments(product_id);
CREATE INDEX IF NOT EXISTS idx_category_assignments_category ON product_category_assignments(category_id);

-- Disable RLS
ALTER TABLE product_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_brands DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_category_assignments DISABLE ROW LEVEL SECURITY;
