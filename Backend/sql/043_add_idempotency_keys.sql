-- Migration 043: Create idempotency keys table for double-submission prevention

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  request_path TEXT NOT NULL,
  request_method TEXT NOT NULL,
  request_body_hash TEXT NOT NULL,
  response_status INT NOT NULL, -- 0 indicates in_progress/started
  response_body JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Index by key for quick lookups
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_key ON public.idempotency_keys(key);

-- Index by expires_at for cleanup operations
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at ON public.idempotency_keys(expires_at);

-- Disable Row Level Security as this is internal state
ALTER TABLE public.idempotency_keys DISABLE ROW LEVEL SECURITY;
