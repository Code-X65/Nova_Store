-- Add new_email column to verification_tokens table
ALTER TABLE verification_tokens ADD COLUMN IF NOT EXISTS new_email TEXT;
