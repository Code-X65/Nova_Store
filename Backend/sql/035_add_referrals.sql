-- 035_add_referrals.sql
-- Add referrals columns to users table and backfill existing users

-- 1. Add columns to public.users (nullable first)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_source TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_source_other TEXT;

-- 2. Create indexes for quick lookups
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON public.users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON public.users(referred_by);

-- 3. Create PL/pgSQL function to generate a unique 12-character alphanumeric code
CREATE OR REPLACE FUNCTION generate_unique_referral_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INT;
  is_unique BOOLEAN := FALSE;
BEGIN
  WHILE NOT is_unique LOOP
    result := '';
    FOR i IN 1..12 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    
    -- Check uniqueness
    SELECT NOT EXISTS (SELECT 1 FROM public.users WHERE referral_code = result) INTO is_unique;
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 4. Backfill existing users with unique referral codes
UPDATE public.users 
SET referral_code = generate_unique_referral_code() 
WHERE referral_code IS NULL;

-- 5. Alter referral_code to NOT NULL for future records
ALTER TABLE public.users ALTER COLUMN referral_code SET NOT NULL;
