/*
 Usage:
   1) Add these to your env file (do NOT prefix service role with NEXT_PUBLIC):
      NEXT_PUBLIC_SUPABASE_URL=...
      SUPABASE_SERVICE_ROLE_KEY=...
   2) Run:
      node scripts/create-admin.js admin@example.com "secure-password" "Admin User"
*/

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const email = process.argv[2] || 'admin@example.com';
  const password = process.argv[3] || 'secure-password';
  const name = process.argv[4] || 'Admin User';

  console.log('Creating admin user for email:', email);
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (error) {
    console.error('Error creating user:', error.message);
    process.exit(1);
  }

  const user = data.user;
  console.log('Admin user created:', { id: user.id, email: user.email });

  // Insert admin role into profiles table
  const { error: roleErr } = await supabaseAdmin
    .from('profiles')
    .insert({ id: user.id, role: 'admin' });

  if (roleErr) {
    console.error('Warning: could not insert admin profile role:', roleErr.message);
  } else {
    console.log('Inserted admin role into profiles for', user.id);
  }

  console.log('\nAdmin UUID:', user.id);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
