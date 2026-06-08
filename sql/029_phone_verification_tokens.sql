CREATE TABLE IF NOT EXISTS phone_verification_tokens (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token         TEXT NOT NULL,         -- 6-digit OTP
  phone_number  TEXT NOT NULL,         -- number the OTP was sent to
  expires_at    TIMESTAMP WITH TIME ZONE NOT NULL,
  used          BOOLEAN DEFAULT FALSE,
  attempt_count INT DEFAULT 0,         -- track brute-force attempts
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_verification_token_user    ON phone_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_phone_verification_token_phone   ON phone_verification_tokens(phone_number);
CREATE INDEX IF NOT EXISTS idx_phone_verification_token_token    ON phone_verification_tokens(token);