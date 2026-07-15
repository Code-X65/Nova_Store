-- ============================================================
-- 094: CMS / Content Management
-- ============================================================
-- Homepage banners, static pages, and blog posts. Plain-text
-- content field (HTML or markdown, admin's choice) — no rich
-- WYSIWYG editor in this pass. New permissions: cms:read, cms:write.
-- ============================================================

CREATE TABLE IF NOT EXISTS cms_banners (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       TEXT NOT NULL,
  image_url   TEXT NOT NULL,
  link_url    TEXT,
  position    TEXT NOT NULL DEFAULT 'hero' CHECK (position IN ('hero', 'secondary', 'sidebar')),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  starts_at   TIMESTAMP WITH TIME ZONE,
  ends_at     TIMESTAMP WITH TIME ZONE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cms_banners_position ON cms_banners(position, is_active);

CREATE TABLE IF NOT EXISTS cms_pages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug            TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  content         TEXT,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  meta_title      TEXT,
  meta_description TEXT,
  published_at    TIMESTAMP WITH TIME ZONE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cms_blog_posts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug            TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  excerpt         TEXT,
  content         TEXT,
  cover_image_url TEXT,
  author_admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at    TIMESTAMP WITH TIME ZONE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cms_pages_status ON cms_pages(status);
CREATE INDEX IF NOT EXISTS idx_cms_blog_posts_status ON cms_blog_posts(status);

ALTER TABLE cms_banners DISABLE ROW LEVEL SECURITY;
ALTER TABLE cms_pages DISABLE ROW LEVEL SECURITY;
ALTER TABLE cms_blog_posts DISABLE ROW LEVEL SECURITY;

INSERT INTO permissions (key, name, description, category)
VALUES
  ('cms:read',  'Read CMS Content',   'View banners, pages, and blog posts', 'marketing'),
  ('cms:write', 'Manage CMS Content', 'Create, edit, and publish banners, pages, and blog posts', 'marketing')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

DO $$
DECLARE v_role_id UUID; BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = 'SUPER_ADMIN';
  IF v_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, p.id FROM permissions p WHERE p.key IN ('cms:read','cms:write')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

DO $$
DECLARE v_role_id UUID; BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = 'MARKETING_SPECIALIST';
  IF v_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, p.id FROM permissions p WHERE p.key IN ('cms:read','cms:write')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
