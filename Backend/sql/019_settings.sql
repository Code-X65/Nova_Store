-- 1. Settings Table (general key-value store with type safety)
CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,                -- Setting identifier (e.g., 'currency.default')
  value TEXT NOT NULL,                     -- Stored as text, cast based on type
  value_type TEXT DEFAULT 'string' CHECK (value_type IN ('string', 'number', 'boolean', 'json')),
  description TEXT,
  group_name TEXT DEFAULT 'general',      -- 'currency', 'tax', 'shipping', 'store', 'email', etc.
  is_public BOOLEAN DEFAULT FALSE,        -- If true, accessible via public endpoint (e.g., currency)
  is_encrypted BOOLEAN DEFAULT FALSE,     -- For sensitive values (e.g., API keys)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Setting Change History (audit trail)
CREATE TABLE IF NOT EXISTS setting_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  setting_id UUID NOT NULL REFERENCES settings(id) ON DELETE CASCADE,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID REFERENCES users(id),
  change_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
CREATE INDEX IF NOT EXISTS idx_settings_group ON settings(group_name);
CREATE INDEX IF NOT EXISTS idx_setting_history_setting ON setting_history(setting_id);

-- Disable RLS
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE setting_history DISABLE ROW LEVEL SECURITY;
