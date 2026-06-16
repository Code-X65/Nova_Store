-- 037_disable_rls_phone_tokens.sql
-- Disable RLS on phone_verification_tokens to align with other tables

ALTER TABLE public.phone_verification_tokens DISABLE ROW LEVEL SECURITY;
