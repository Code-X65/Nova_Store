-- ============================================================
-- 091: Marketing Campaigns / Flash Sales
-- ============================================================
-- Admin-managed, time-boxed discount campaigns that apply to all
-- products, a category, a brand, or an explicit product list.
-- Reuses the existing 'marketing:read'/'marketing:write'/'marketing:approve'
-- permission keys seeded in 081_rbac_new_roles.sql (already granted to
-- MARKETING_SPECIALIST and SUPER_ADMIN) — no new permissions required.
-- ============================================================

CREATE TABLE IF NOT EXISTS campaigns (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  discount_type   TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value  NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
  scope           TEXT NOT NULL DEFAULT 'all_products' CHECK (scope IN ('all_products', 'category', 'brand', 'products')),
  starts_at       TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at         TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID REFERENCES admins(id) ON DELETE SET NULL,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT chk_campaign_dates CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_campaigns_store_id ON campaigns(store_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_active_window ON campaigns(is_active, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS campaign_products (
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, product_id)
);

CREATE TABLE IF NOT EXISTS campaign_categories (
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, category_id)
);

CREATE TABLE IF NOT EXISTS campaign_brands (
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  brand_id    UUID NOT NULL REFERENCES product_brands(id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, brand_id)
);

ALTER TABLE campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_products DISABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_brands DISABLE ROW LEVEL SECURITY;
