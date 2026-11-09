import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * ==============================================================================
 * SECURE SUPABASE AUTH ADMINISTRATOR SETUP SCRIPT
 * ==============================================================================
 * This script runs strictly server-side using the trusted Supabase Auth Admin API.
 * It NEVER runs in the browser and NEVER commits or exposes plaintext credentials.
 *
 * REQUIRED ENVIRONMENT VARIABLES:
 *   SUPABASE_SERVICE_ROLE_KEY: The project service_role secret key (Dashboard > Project Settings > API)
 *   ADMIN_PASSWORD:            Initial password chosen securely by the project administrator
 *
 * OPTIONAL ENVIRONMENT VARIABLES:
 *   SUPABASE_URL:              Supabase project URL (defaults to VITE_SUPABASE_URL from env)
 *   ADMIN_EMAIL:               Admin email (defaults to "admin@awesomeadventure.tours")
 *
 * USAGE:
 *   SUPABASE_SERVICE_ROLE_KEY="ey..." ADMIN_PASSWORD="StrongPassword123!" npx tsx scripts/setup-admin.ts
 * ==============================================================================
 */

async function main() {
  const getValidUrl = (url?: string) => (url && (url.startsWith('https://') || url.startsWith('http://'))) ? url : null;
  const supabaseUrl = getValidUrl(process.env.SUPABASE_URL) || getValidUrl(process.env.VITE_SUPABASE_URL) || 'https://cyifhjqqvtiguitrziqs.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@awesomeadventure.tours').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;

  console.log('================================================================');
  console.log('  Awesome Adventure Tours — Supabase Admin Provisioning');
  console.log('================================================================\n');

  if (!supabaseUrl) {
    console.error('❌ Error: SUPABASE_URL (or VITE_SUPABASE_URL) environment variable is required.');
    process.exit(1);
  }

  if (!serviceRoleKey) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required.');
    console.error('   Please retrieve your service_role key from your Supabase Dashboard:');
    console.error('   Project Settings -> API -> Project API keys -> service_role (secret)');
    console.error('\n   Run: SUPABASE_SERVICE_ROLE_KEY="<secret>" ADMIN_PASSWORD="<password>" npx tsx scripts/setup-admin.ts');
    process.exit(1);
  }

  if (!adminPassword || adminPassword.length < 8) {
    console.error('❌ Error: ADMIN_PASSWORD environment variable is required (minimum 8 characters).');
    console.error('   Run: ADMIN_PASSWORD="<your-secure-password>" SUPABASE_SERVICE_ROLE_KEY="<secret>" npx tsx scripts/setup-admin.ts');
    process.exit(1);
  }

  console.log(`Connecting to Supabase at: ${supabaseUrl}`);
  console.log(`Target Admin Account:      ${adminEmail}\n`);

  // Initialize administrative client with service_role privileges
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // 1. Check if user already exists via Admin API
    const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 100,
    });

    if (listError) {
      throw new Error(`Failed to list existing auth users: ${listError.message}`);
    }

    const existingUser = usersData.users.find(
      (u) => u.email?.toLowerCase() === adminEmail
    );

    let userId: string;

    if (existingUser) {
      console.log(`✓ Auth user already exists: ${existingUser.id}`);
      userId = existingUser.id;

      // Update password and metadata to verify role state
      const { data: updatedUser, error: updateError } = await adminClient.auth.admin.updateUserById(
        userId,
        {
          password: adminPassword,
          email_confirm: true,
          app_metadata: {
            ...existingUser.app_metadata,
            role: 'admin',
          },
          user_metadata: {
            ...existingUser.user_metadata,
            role: 'admin',
            full_name: 'Awesome Adventure Administrator',
          },
        }
      );

      if (updateError) {
        throw new Error(`Failed to update existing auth user: ${updateError.message}`);
      }
      console.log('✓ Successfully verified credentials and confirmed email on Auth user.');
    } else {
      console.log('Creating new Auth user via Supabase Auth Admin API...');
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        app_metadata: {
          role: 'admin',
        },
        user_metadata: {
          role: 'admin',
          full_name: 'Awesome Adventure Administrator',
        },
      });

      if (createError || !newUser.user) {
        throw new Error(`Failed to create auth user: ${createError?.message}`);
      }

      userId = newUser.user.id;
      console.log(`✓ Auth user created successfully: ${userId}`);
    }

    // 2. Synchronize and verify public.profiles record
    console.log('Synchronizing public.profiles record...');
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: userId,
        email: adminEmail,
        full_name: existingUser?.user_metadata?.full_name || 'Administrator',
        role: 'admin',
        is_confirmed: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (profileError) {
      throw new Error(`Failed to upsert public.profiles record: ${profileError.message}`);
    }

    // 3. Explicit verification: Query public.profiles directly to verify the persisted role
    const { data: verifiedProfile, error: verifyError } = await adminClient
      .from('profiles')
      .select('id, email, role, is_confirmed')
      .eq('id', userId)
      .single();

    if (verifyError || !verifiedProfile) {
      throw new Error(`Verification query failed for profile ${userId}: ${verifyError?.message || 'Profile not found'}`);
    }

    if (verifiedProfile.role !== 'admin') {
      throw new Error(
        `Admin provisioning failed honest verification: public.profiles.role is "${verifiedProfile.role}" instead of "admin". Trigger or policy intervention prevented promotion.`
      );
    }

    console.log(`✓ Public profile strictly verified: id=${verifiedProfile.id}, role="${verifiedProfile.role}"`);

    console.log('\n================================================================');
    console.log('✅ Admin account setup completed successfully!');
    console.log(`   Email: ${adminEmail}`);
    console.log('   Role:  admin');
    console.log('   Status: Confirmed & Active');
    console.log('================================================================\n');
  } catch (err: any) {
    console.error('\n❌ Admin setup encountered an error:');
    console.error(`   ${err.message || err}`);
    process.exit(1);
  }
}

main();
