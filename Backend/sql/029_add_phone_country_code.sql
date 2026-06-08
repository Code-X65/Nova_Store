-- Add missing phone_country_code column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_country_code TEXT;