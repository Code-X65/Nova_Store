-- 1. Notification Templates (for admin-customizable messages)
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,               -- e.g., 'order_shipped', 'low_stock_alert'
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_template TEXT,                     -- Handlebars/Mustache style template
  text_template TEXT,                     -- Plain text fallback
  variables JSONB DEFAULT '[]',           -- List of variable names: ['orderNumber', 'trackingNumber']
  channel TEXT[] DEFAULT '{email,inapp}', -- 'email', 'sms', 'inapp'
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. User Notification Settings (preferences per user)
CREATE TABLE IF NOT EXISTS notification_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  email_order_confirmation BOOLEAN DEFAULT TRUE,
  email_order_shipped BOOLEAN DEFAULT TRUE,
  email_order_delivered BOOLEAN DEFAULT TRUE,
  email_promotions BOOLEAN DEFAULT FALSE,
  email_newsletter BOOLEAN DEFAULT FALSE,
  sms_order_updates BOOLEAN DEFAULT FALSE,
  inapp_all BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Notifications (individual notification records)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL = system-wide broadcast
  type TEXT NOT NULL,                      -- e.g., 'order_shipped', 'password_reset', 'low_stock'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',                -- Additional context: { orderId, trackingNumber, etc. }
  channel TEXT[] DEFAULT '{inapp}',       -- 'email', 'sms', 'inapp'
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  read_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  failed_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast user queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- 4. SMS Logs (track outgoing SMS for audit/debugging)
CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  provider TEXT DEFAULT 'twilio',         -- 'twilio', 'aws_sns', etc.
  provider_message_id TEXT,
  status TEXT DEFAULT 'pending',
  error TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Email Logs (track outgoing emails)
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  template_key TEXT,
  status TEXT DEFAULT 'pending',          -- 'pending', 'sent', 'failed'
  error TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable RLS
ALTER TABLE notification_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE sms_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs DISABLE ROW LEVEL SECURITY;
