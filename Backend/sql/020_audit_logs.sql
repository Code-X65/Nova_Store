CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL for system/unauth
  action TEXT NOT NULL,                    -- e.g., 'user.login', 'order.update_status'
  resource_type TEXT,                      -- e.g., 'order', 'product'
  resource_id UUID,                        -- affected record ID
  old_values JSONB,                        -- snapshot before change
  new_values JSONB,                        -- snapshot after change
  ip_address INET,
  user_agent TEXT,
  request_id TEXT,                         -- from middleware correlation
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
