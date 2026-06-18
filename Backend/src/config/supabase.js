const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Standard client — uses anon key, subject to RLS
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client — uses service role key, bypasses RLS for server-side operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey || supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

module.exports = supabase;
module.exports.supabaseAdmin = supabaseAdmin;
