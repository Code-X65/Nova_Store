-- 073: Persist notification delivery audit trail and dead-letter queue to Postgres.
-- This ensures failed deliveries are queryable and auditable, not just in Redis.

-- ─── notification_deliveries ─────────────────────────────────────────────────
-- Tracks every sendToUser call with its channel-level outcome.

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('inapp', 'email', 'sms')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered', 'bounced')),
  provider_message_id TEXT,
  error TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_notification ON notification_deliveries (notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_user ON notification_deliveries (user_id);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status ON notification_deliveries (status);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_template ON notification_deliveries (template_key);

-- ─── notification_dlq ─────────────────────────────────────────────────────────
-- Persists dead-lettered async queue jobs that exceeded max retry attempts.

CREATE TABLE IF NOT EXISTS notification_dlq (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  job_id TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  attempts INT NOT NULL DEFAULT 0,
  error TEXT NOT NULL,
  failed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  recovered BOOLEAN NOT NULL DEFAULT FALSE,
  recovered_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_notification_dlq_job_id ON notification_dlq (job_id);
CREATE INDEX IF NOT EXISTS idx_notification_dlq_user ON notification_dlq (user_id);
CREATE INDEX IF NOT EXISTS idx_notification_dlq_recovered ON notification_dlq (recovered);
