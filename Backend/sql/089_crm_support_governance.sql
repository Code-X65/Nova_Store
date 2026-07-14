-- ============================================================
-- 089: CRM & Support Governance (Phase 7)
-- ============================================================

-- 1. Customer segments (rule-based)
CREATE TABLE IF NOT EXISTS segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  rules JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_segments_active ON segments(is_active);

-- 2. Support tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES users(id),
  subject TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','waiting_customer','resolved','closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  assigned_to UUID REFERENCES users(id),
  category TEXT,
  order_id UUID REFERENCES orders(id),
  sla_due_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tickets_customer ON support_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON support_tickets(assigned_to);

-- 3. Ticket messages
CREATE TABLE IF NOT EXISTS ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id),
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer','agent','system')),
  message TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id);

-- 4. Customer comms log (outbound)
CREATE TABLE IF NOT EXISTS customer_comms_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES users(id),
  channel TEXT NOT NULL CHECK (channel IN ('email','sms','in_app','push')),
  template_key TEXT,
  subject TEXT,
  body TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  sent_by UUID REFERENCES users(id),
  metadata JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_comms_customer ON customer_comms_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_comms_channel ON customer_comms_log(channel);

-- 5. Customer behavior events
CREATE TABLE IF NOT EXISTS customer_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES users(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('page_view','product_view','cart_add','cart_remove','checkout_start','checkout_abandon','search','wishlist_add','review_submit')),
  product_id UUID REFERENCES products(id),
  category_id UUID REFERENCES product_categories(id),
  session_id TEXT,
  referrer TEXT,
  device_type TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customer_events_customer ON customer_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_events_type ON customer_events(event_type);
CREATE INDEX IF NOT EXISTS idx_customer_events_created ON customer_events(created_at DESC);

ALTER TABLE support_tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE customer_comms_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE customer_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE segments DISABLE ROW LEVEL SECURITY;

-- ─── Ticket permissions ──────────────────────────────────────────────────────
INSERT INTO permissions (key, name, description, category)
VALUES
  ('ticket:read',  'Read Tickets',    'View support tickets',        'crm'),
  ('ticket:write', 'Manage Tickets',  'Create and update tickets',   'crm'),
  ('ticket:resolve','Resolve Tickets','Close or resolve tickets',    'crm'),
  ('segment:read',  'Read Segments',   'View customer segments',      'crm'),
  ('segment:write', 'Manage Segments', 'Create and update segments',  'crm'),
  ('customer_event:read','Read Customer Events','View behavior tracking data','crm')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

DO $$
DECLARE v_role_id UUID; BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = 'CUSTOMER_SUPPORT';
  IF v_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, p.id FROM permissions p
    WHERE p.key IN ('ticket:read','ticket:write','ticket:resolve','crm:read','customer:read')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

DO $$
DECLARE v_role_id UUID; BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = 'SUPER_ADMIN';
  IF v_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, p.id FROM permissions p
    WHERE p.key IN ('ticket:read','ticket:write','ticket:resolve','segment:read','segment:write','customer_event:read','crm:read','crm:write','crm:approve')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

DO $$
DECLARE v_role_id UUID; BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = 'MARKETING_SPECIALIST';
  IF v_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, p.id FROM permissions p
    WHERE p.key IN ('segment:read','segment:write','customer_event:read','crm:read','analytics:read')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
