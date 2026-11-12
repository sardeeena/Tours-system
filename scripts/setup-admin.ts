import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { isExpectedAwesomeAdventureToursSupabaseUrl } from '../src/lib/supabaseProjectGuard';

dotenv.config();

/**
 * Securely promotes an already-registered, email-confirmed Awesome Adventure Tours user.
 *
 * Required environment variables:
 *   SUPABASE_URL or VITE_SUPABASE_URL: the exact Awesome Adventure Tours Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY: a server-only Supabase secret/service-role key
 *   ADMIN_EMAIL: the exact email address that already registered and confirmed
 *
 * This script never creates an Auth user, sets/resets a password, or sends an
 * invitation. It invokes the restricted public.set_admin_role_by_email RPC,
 * which is executable only by trusted database operators/service_role.
 *
 * Run:
 *   SUPABASE_URL="https://uvtbtpxtrrmaublrztgv.supabase.co" \
 *   ADMIN_EMAIL="owner@example.com" \
 *   SUPABASE_SERVICE_ROLE_KEY="<server-only-secret>" \
 *   npx tsx scripts/setup-admin.ts
 */
async function main() {
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

  if (!supabaseUrl || !isExpectedAwesomeAdventureToursSupabaseUrl(supabaseUrl)) {
    throw new Error(
      'Refusing to continue: SUPABASE_URL must point to the configured Awesome Adventure Tours project ' +
      '(uvtbtpxtrrmaublrztgv.supabase.co). No fallback project is permitted.'
    );
  }

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required and must remain server-side.');
  }

  if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    throw new Error('ADMIN_EMAIL is required and must be a valid email address.');
  }

  const isServiceCredential =
    serviceRoleKey.startsWith('sb_secret_') ||
    (() => {
      try {
        const payload = serviceRoleKey.split('.')[1];
        if (!payload) return false;
        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
        return decoded.role === 'service_role';
      } catch {
        return false;
      }
    })();

  if (!isServiceCredential) {
    throw new Error('The supplied key is not a recognized Supabase secret/service_role credential.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('Checking for the existing confirmed Awesome Adventure Tours account...');

  let matchingUser: { id: string; email?: string; email_confirmed_at?: string | null } | null = null;
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Could not list Auth users: ${error.message}`);

    matchingUser = data.users.find((user) => user.email?.trim().toLowerCase() === adminEmail) || null;
    if (matchingUser || data.users.length < 1000) break;
  }

  if (!matchingUser) {
    throw new Error(
      `No Auth user exists for ${adminEmail}. Register through the Awesome Adventure Tours website first; this script never creates accounts.`
    );
  }

  if (!matchingUser.email_confirmed_at) {
    throw new Error(
      `The account ${adminEmail} has not confirmed its email. Complete email verification before promotion.`
    );
  }

  // Preserve an existing super_admin. The promotion RPC intentionally assigns
  // the ordinary admin role, so calling it for a super_admin would downgrade
  // the only highest-privilege account.
  const { data: existingProfile, error: existingProfileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', matchingUser.id)
    .maybeSingle();

  if (existingProfileError) {
    throw new Error(`Could not inspect the existing profile role: ${existingProfileError.message}`);
  }

  const preserveSuperAdmin = existingProfile?.role === 'super_admin';
  let promotionResult: unknown = null;

  if (preserveSuperAdmin) {
    console.log('Existing super_admin role detected; preserving it without running the admin promotion RPC.');
  } else {
    const { data, error } = await supabase.rpc(
      'set_admin_role_by_email',
      { target_email: adminEmail }
    );

    if (error) {
      throw new Error(`Trusted admin promotion failed: ${error.message}`);
    }

    promotionResult = data;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id,email,role,is_confirmed')
    .eq('id', matchingUser.id)
    .single();

  if (profileError || !profile) {
    throw new Error(`Could not verify the promoted profile: ${profileError?.message || 'profile not found'}`);
  }

  const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(matchingUser.id);
  if (authError || !authUser.user) {
    throw new Error(`Could not verify Auth app metadata: ${authError?.message || 'Auth user not found'}`);
  }

  const expectedRole = preserveSuperAdmin ? 'super_admin' : 'admin';
  if (
    profile.role !== expectedRole ||
    authUser.user.app_metadata?.role !== expectedRole ||
    !profile.is_confirmed
  ) {
    throw new Error(
      `Promotion verification failed. Expected role=${expectedRole}, profile role=${profile.role}, app_metadata role=${authUser.user.app_metadata?.role}, confirmed=${profile.is_confirmed}.`
    );
  }

  console.log('Administrator account verified successfully.');
  console.log(`Email: ${profile.email}`);
  console.log(`Role: ${profile.role}`);
  console.log(`User ID: ${profile.id}`);
  console.log(String(promotionResult || 'Trusted promotion completed.'));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Admin setup failed: ${message}`);
  process.exitCode = 1;
});
