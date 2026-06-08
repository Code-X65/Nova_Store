# Admin Seeding Script

This script seeds the predefined admin user into the database.

## Admin Credentials
- Email: admin@novastore.com
- Password: Admin.

## Usage

To seed the admin user, run:

```bash
node src/scripts/seed-admin.js
```

## Requirements
- Ensure your `.env` file is properly configured with Supabase credentials:
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY (required for admin operations)
  - SUPABASE_ANON_KEY

## What the script does
1. Checks if an admin with email `admin@novastore.com` already exists
2. If not exists, creates the admin user with:
   - Hashed password (using bcrypt with 12 salt rounds)
   - First name: super
   - Last name: admin
   - Department: super admin
   - Access level: super_admin
   - Email and phone pre-verified (true)
   - Account active (true)
3. If already exists, skips creation and reports existing ID

## Notes
- The admin role is handled by the authentication service logic which checks for the specific email
- The password "Admin." should be considered temporary and changed after first login in a production environment
- This script uses the Supabase admin client (service role key) to bypass RLS for the initial seeding