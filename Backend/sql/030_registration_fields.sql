-- 1. Home address (compact JSON: { street, city, state, postalCode, country })
ALTER TABLE users ADD COLUMN IF NOT EXISTS home_address JSONB;

-- 2. Referral-source tracking at signup
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_source TEXT;   -- e.g. 'facebook', 'instagram', 'friend'
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by UUID;      -- user.id of referrer

-- 3. Phone verification status
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN DEFAULT FALSE;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_users_referred_by     ON users(referred_by);
CREATE INDEX IF NOT EXISTS idx_users_referral_source ON users(referral_source);
