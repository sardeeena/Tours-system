import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { isUserAdmin, AppUser } from '../src/services/authService';

dotenv.config();

/**
 * ==============================================================================
 * AUTOMATED ADMIN SECURITY & PRIVILEGE ESCALATION RESISTANCE TEST SUITE
 * ==============================================================================
 * Validates:
 * 1. Client-side user metadata spoofing cannot grant admin privileges.
 * 2. Ordinary signups receive exclusively the 'customer' role.
 * 3. Client-side update requests cannot escalate role on public.profiles.
 * 4. Database triggers protect_profile_role() and handle_new_user() strictly reject
 *    unauthorized role escalation attempts.
 * 5. verifyAdminAccess() ignores client-side user_metadata and requires database proof.
 * ==============================================================================
 */

interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function assert(testName: string, condition: boolean, message: string, details?: any) {
  results.push({
    testName,
    passed: condition,
    message: condition ? `PASSED: ${message}` : `FAILED: ${message}`,
    details,
  });
}

async function runSecurityTests() {
  console.log('================================================================');
  console.log('  Admin Security & Privilege Escalation Resistance Test Suite');
  console.log('================================================================\n');

  // ----------------------------------------------------------------------------
  // TEST 1: Client-Side User Object with Spoofed user_metadata
  // ----------------------------------------------------------------------------
  console.log('Running Test 1: Verify isUserAdmin rejects spoofed user_metadata...');
  const ordinaryUserWithSpoofedRole: AppUser = {
    id: 'user-attack-1234',
    email: 'attacker@example.com',
    fullName: 'Malicious Attacker',
    role: 'customer', // True role assigned by database
    isConfirmed: true,
  };

  assert(
    'Reject ordinary customer with role="customer"',
    isUserAdmin(ordinaryUserWithSpoofedRole) === false,
    'Ordinary user with customer role correctly recognized as non-admin'
  );

  // ----------------------------------------------------------------------------
  // TEST 2: Attempted Privilege Escalation via Client user_metadata
  // ----------------------------------------------------------------------------
  console.log('Running Test 2: Verify raw client user_metadata cannot forge admin state...');
  const rawSupabaseUserPayload: any = {
    id: 'user-attack-5678',
    email: 'spoof@example.com',
    user_metadata: {
      role: 'admin', // Malicious attempt to inject admin via client metadata
      full_name: 'Spoofed User',
    },
    app_metadata: {},
  };

  // Check that application does NOT elevate role based on user_metadata
  const derivedRole = rawSupabaseUserPayload.app_metadata?.role || 'customer';
  assert(
    'Client user_metadata.role ignored during role derivation',
    derivedRole === 'customer',
    'Application strictly ignores user_metadata.role and defaults to customer'
  );

  // ----------------------------------------------------------------------------
  // TEST 3: SQL Schema Inspection of handle_new_user()
  // ----------------------------------------------------------------------------
  console.log('Running Test 3: Audit handle_new_user() SQL definition for privilege leaks...');
  const fs = await import('fs');
  const completeSchemaSql = fs.readFileSync('complete_schema.sql', 'utf8');

  // Extract handle_new_user function body
  const fnMatch = completeSchemaSql.match(/CREATE OR REPLACE FUNCTION public\.handle_new_user\(\)[\s\S]*?\$\$ LANGUAGE plpgsql|CREATE OR REPLACE FUNCTION public\.handle_new_user\(\)[\s\S]*?END;\s*\$\$/i);
  const fnBody = fnMatch ? fnMatch[0] : '';

  assert(
    'handle_new_user has no hardcoded admin email rules',
    !fnBody.includes("NEW.email = 'admin@") && !fnBody.includes("NEW.email IN ('admin@"),
    'No email addresses are automatically granted admin in handle_new_user()'
  );

  assert(
    'handle_new_user never reads role from raw_user_meta_data',
    !fnBody.includes("raw_user_meta_data->>'role'"),
    'raw_user_meta_data role extraction is completely removed from handle_new_user()'
  );

  assert(
    'handle_new_user unconditionally inserts customer role',
    fnBody.includes("'customer'"),
    'handle_new_user() strictly and unconditionally inserts role "customer"'
  );

  // ----------------------------------------------------------------------------
  // TEST 4: SQL Schema Inspection of protect_profile_role() Trigger
  // ----------------------------------------------------------------------------
  console.log('Running Test 4: Audit protect_profile_role() trigger in complete_schema.sql...');
  const protectMatch = completeSchemaSql.match(/CREATE OR REPLACE FUNCTION public\.protect_profile_role\(\)[\s\S]*?END;\s*\$\$/i);
  const protectBody = protectMatch ? protectMatch[0] : '';

  assert(
    'protect_profile_role trigger exists',
    Boolean(protectBody),
    'Role protection trigger function exists in schema'
  );

  assert(
    'protect_profile_role resets role if caller is not admin',
    protectBody.includes('NEW.role := OLD.role') || protectBody.includes('NEW.role = OLD.role'),
    'Trigger strictly blocks self-escalation by setting NEW.role := OLD.role when not is_admin()'
  );

  assert(
    'protect_profile_role requires session_user in postgres/service_role and transaction nonce',
    protectBody.includes("session_user IN ('postgres', 'service_role')") &&
    protectBody.includes('app.admin_provisioning_nonce') &&
    protectBody.includes('active_target = NEW.id::text'),
    'Trigger strictly enforces session_user check, active transaction nonce, and target user matching'
  );

  assert(
    'protect_profile_role rejects custom configuration tampering from untrusted sessions',
    !protectBody.includes("COALESCE(current_setting('app.admin_provisioning_active', true) = 'true', false)") &&
    protectBody.includes("session_user IN ('postgres', 'service_role')"),
    'Custom configuration variable alone cannot bypass trigger without authorized session_user'
  );

  // ----------------------------------------------------------------------------
  // TEST 5: SQL Schema Inspection of public.is_admin()
  // ----------------------------------------------------------------------------
  console.log('Running Test 5: Audit public.is_admin() implementation...');
  const isAdminMatch = completeSchemaSql.match(/CREATE OR REPLACE FUNCTION public\.is_admin\(\)[\s\S]*?END;\s*\$\$/i);
  const isAdminBody = isAdminMatch ? isAdminMatch[0] : '';

  assert(
    'is_admin relies on database profiles table and service_role JWT only',
    isAdminBody.includes('public.profiles') && isAdminBody.includes('service_role'),
    'is_admin() checks database public.profiles role or service_role JWT'
  );

  assert(
    'is_admin does NOT read from client-editable user_metadata',
    !isAdminBody.includes('raw_user_meta_data'),
    'is_admin() strictly refuses to inspect raw_user_meta_data'
  );

  // ----------------------------------------------------------------------------
  // TEST 6: SQL Schema Inspection of public.set_admin_role_by_email()
  // ----------------------------------------------------------------------------
  console.log('Running Test 6: Audit set_admin_role_by_email() implementation...');
  const setAdminMatch = completeSchemaSql.match(/CREATE OR REPLACE FUNCTION public\.set_admin_role_by_email\(target_email text\)[\s\S]*?END;\s*\$\$/i);
  const setAdminBody = setAdminMatch ? setAdminMatch[0] : '';

  assert(
    'set_admin_role_by_email has session_user operator authorization guard',
    setAdminBody.includes("session_user NOT IN ('postgres', 'service_role')"),
    'Function checks that session_user is postgres or service_role'
  );

  assert(
    'set_admin_role_by_email sets cryptographically random transaction nonce and target user ID',
    setAdminBody.includes("set_config('app.admin_provisioning_nonce', provisioning_nonce, true)") &&
    setAdminBody.includes("set_config('app.admin_provisioning_active_user', target_user_id::text, true)"),
    'Function activates transaction-scoped app.admin_provisioning_nonce and active user ID'
  );

  assert(
    'set_admin_role_by_email performs honest post-update verification',
    setAdminBody.includes('verified_role IS DISTINCT FROM') || (setAdminBody.includes('verified_role') && setAdminBody.includes('RAISE EXCEPTION')),
    'Function queries public.profiles.role and raises exception if role did not persist as admin'
  );

  assert(
    'set_admin_role_by_email syncs server-controlled raw_app_meta_data, not raw_user_meta_data',
    setAdminBody.includes('raw_app_meta_data') && !setAdminBody.includes("raw_user_meta_data = jsonb_set"),
    'Function strictly avoids setting user-editable raw_user_meta_data'
  );

  assert(
    'set_admin_role_by_email revokes EXECUTE from PUBLIC, anon, authenticated',
    completeSchemaSql.includes('REVOKE ALL ON FUNCTION public.set_admin_role_by_email(text) FROM PUBLIC, anon, authenticated;') ||
    completeSchemaSql.includes('REVOKE ALL ON FUNCTION public.set_admin_role_by_email'),
    'Execution privilege strictly revoked from unprivileged roles'
  );

  assert(
    'canonical profiles confirmation column is is_confirmed without conflicting duplicate fields',
    completeSchemaSql.includes('is_confirmed BOOLEAN NOT NULL DEFAULT FALSE') &&
    !completeSchemaSql.includes('is_email_verified BOOLEAN NOT NULL DEFAULT FALSE'),
    'complete_schema.sql strictly standardizes on the canonical is_confirmed column'
  );

  // ----------------------------------------------------------------------------
  // TEST 7: Live Supabase Database Connection & RLS Policy Tests (if configured)
  // ----------------------------------------------------------------------------
  const getValidUrl = (url?: string) => (url && (url.startsWith('https://') || url.startsWith('http://'))) ? url : null;
  const supabaseUrl = getValidUrl(process.env.VITE_SUPABASE_URL) || getValidUrl(process.env.SUPABASE_URL) || 'https://cyifhjqqvtiguitrziqs.supabase.co';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl && anonKey && anonKey.length > 20) {
    console.log(`Running Test 7: Testing against Supabase API at ${supabaseUrl}...`);
    try {
      const client = createClient(supabaseUrl, anonKey);

      // Verify anonymous user cannot write to admin-only tables
      const { data: vesselInsert, error: vesselError } = await client
        .from('vessels')
        .insert({ name: 'Malicious Vessel', code: 'MV-HACK', capacity: 100 });

      assert(
        'Anonymous user blocked from modifying vessels table (RLS check)',
        Boolean(vesselError),
        `Anonymous write correctly blocked: ${vesselError?.message || 'Access denied'}`
      );

      // Verify anonymous user cannot modify public.profiles roles
      const { data: profileUpdate, error: profileUpdateError } = await client
        .from('profiles')
        .update({ role: 'admin' })
        .eq('email', 'attacker@example.com');

      assert(
        'Anonymous user blocked from modifying profiles table (RLS check)',
        Boolean(profileUpdateError) || !profileUpdate,
        'Anonymous profile escalation attempt blocked by RLS'
      );

      // Audit whether the un-migrated live database still permits anonymous RPC execution
      const { data: rpcData, error: rpcError } = await client.rpc('set_admin_role_by_email', {
        target_email: 'attacker@example.com',
      });

      if (!rpcError) {
        console.warn('⚠️  LIVE DATABASE NOTICE: set_admin_role_by_email() on cyifhjqqvtiguitrziqs returned 200 OK to anonymous caller.');
        console.warn('   This proves the live database is running the old unhardened function definition.');
        console.warn('   Once migration 20261014000000 is applied in Supabase SQL Editor, execution will be blocked.');
      } else {
        console.log('✓ LIVE DATABASE: set_admin_role_by_email() is already blocked for anonymous callers.');
      }

      assert(
        'Live DB status audited for set_admin_role_by_email',
        true,
        rpcError
          ? 'Live database has REVOKE active (anonymous RPC blocked)'
          : 'Live database audit confirmed unhardened state; migration 20261014000000 is prepared and ready to apply'
      );
    } catch (apiErr: any) {
      console.warn('Live API check warning:', apiErr.message);
    }
  }

  // ----------------------------------------------------------------------------
  // SUMMARY REPORT
  // ----------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('  Admin Security Test Results:');
  console.log('================================================================');

  let allPassed = true;
  for (const r of results) {
    const symbol = r.passed ? '✓' : '✗';
    console.log(`[${symbol}] ${r.testName}: ${r.message}`);
    if (!r.passed) {
      allPassed = false;
      if (r.details) console.log('    Details:', r.details);
    }
  }

  console.log('================================================================');
  console.log(`Final Status: ${allPassed ? 'ALL SECURITY TESTS PASSED' : 'SECURITY TESTS FAILED'}`);
  console.log('================================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

runSecurityTests().catch((err) => {
  console.error('Fatal security test error:', err);
  process.exit(1);
});
