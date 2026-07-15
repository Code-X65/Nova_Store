-- ============================================================
-- 093: Product Q&A
-- ============================================================
-- Simple single-table question/answer model (one question, one
-- store-provided answer) — no threaded/community answers, no
-- public abuse-reporting in this pass (admin can hide/delete
-- directly). New permissions: qa:read, qa:write.
-- ============================================================

CREATE TABLE IF NOT EXISTS product_questions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question      TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'hidden')),
  answer        TEXT,
  answered_by   UUID REFERENCES admins(id) ON DELETE SET NULL,
  answered_at   TIMESTAMP WITH TIME ZONE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_questions_product_id ON product_questions(product_id);
CREATE INDEX IF NOT EXISTS idx_product_questions_status ON product_questions(status);

ALTER TABLE product_questions DISABLE ROW LEVEL SECURITY;

INSERT INTO permissions (key, name, description, category)
VALUES
  ('qa:read',  'Read Product Q&A',   'View customer product questions', 'catalog'),
  ('qa:write', 'Manage Product Q&A', 'Answer, hide, or delete questions', 'catalog')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

DO $$
DECLARE v_role_id UUID; BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = 'SUPER_ADMIN';
  IF v_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, p.id FROM permissions p WHERE p.key IN ('qa:read','qa:write')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

DO $$
DECLARE v_role_id UUID; BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = 'CUSTOMER_SUPPORT';
  IF v_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, p.id FROM permissions p WHERE p.key IN ('qa:read','qa:write')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

DO $$
DECLARE v_role_id UUID; BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = 'CATALOG_MANAGER';
  IF v_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, p.id FROM permissions p WHERE p.key IN ('qa:read','qa:write')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
