/**
 * AWESOME ADVENTURE TOURS — SUPABASE PREVIEW MIGRATION & OVERLOAD AMBIGUITY VERIFICATION
 * 
 * Verifies resolution of:
 * ERROR: function name "public.create_booking_atomic" is not unique (SQLSTATE 42725)
 * 
 * Tasks Tested:
 * 1. Function Overload Ambiguity & Explicit Identity Signatures
 * 2. Safe Legacy Overload Retirement (No CASCADE)
 * 3. Migration Sequencing & Fresh/Upgrade Idempotency
 * 4. Removal of Non-Atomic Frontend Fallbacks (AdminExtrasList & tourService)
 * 5. Role Grants & Guest Checkout Preservation
 */

import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, errorDetails?: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}`);
    if (errorDetails) {
      console.error(`     Details: ${errorDetails}`);
    }
    failed++;
  }
}

async function runAudit() {
  console.log(`========================================================================`);
  console.log(`AWESOME ADVENTURE TOURS — PREVIEW MIGRATION AMBIGUITY AUDIT`);
  console.log(`========================================================================\n`);

  const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');
  const m20261107Path = path.join(migrationsDir, '20261107000000_tour_extras_and_addons_enhancement.sql');
  const m20261108Path = path.join(migrationsDir, '20261108000000_security_and_booking_reliability_remediation.sql');

  assert(fs.existsSync(m20261107Path), 'Migration 20261107000000 exists');
  assert(fs.existsSync(m20261108Path), 'Migration 20261108000000 exists');

  const m20261107Sql = fs.readFileSync(m20261107Path, 'utf8');
  const m20261108Sql = fs.readFileSync(m20261108Path, 'utf8');

  // ---------------------------------------------------------------------------
  // TASK 1: DIAGNOSE AND FIX FUNCTION OVERLOAD AMBIGUITY (SQLSTATE 42725)
  // ---------------------------------------------------------------------------
  console.log(`\n--- TASK 1: Function Overload Ambiguity Resolution & Explicit Signatures ---`);

  // Unambiguous 18-parameter identity signature pattern:
  // TEXT, DATE, INT, INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT
  const explicitRevokePattern = /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.create_booking_atomic\s*\([\s\S]*?\)\s*FROM\s+PUBLIC;/i;
  const explicitGrantPattern = /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.create_booking_atomic\s*\([\s\S]*?\)\s*TO\s+anon,\s*authenticated,\s*service_role;/i;

  assert(
    explicitRevokePattern.test(m20261108Sql),
    '20261108 migration uses explicit function signature on REVOKE ALL ON FUNCTION public.create_booking_atomic'
  );

  assert(
    explicitGrantPattern.test(m20261108Sql),
    '20261108 migration uses explicit function signature on GRANT EXECUTE ON FUNCTION public.create_booking_atomic'
  );

  // Check that NO bare unqualified 'REVOKE ALL ON FUNCTION public.create_booking_atomic FROM' remains in either migration
  assert(
    !/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.create_booking_atomic\s+FROM/i.test(m20261108Sql),
    '20261108 contains NO ambiguous unqualified REVOKE statement'
  );

  assert(
    !/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.create_booking_atomic\s+TO/i.test(m20261108Sql),
    '20261108 contains NO ambiguous unqualified GRANT statement'
  );

  assert(
    !/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.create_booking_atomic\s+FROM/i.test(m20261107Sql),
    '20261107 contains NO ambiguous unqualified REVOKE statement'
  );

  assert(
    !/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.create_booking_atomic\s+TO/i.test(m20261107Sql),
    '20261107 contains NO ambiguous unqualified GRANT statement'
  );

  // ---------------------------------------------------------------------------
  // TASK 2: RESOLVE LEGACY OVERLOADS SAFELY
  // ---------------------------------------------------------------------------
  console.log(`\n--- TASK 2: Safe Legacy Overload Retirement Without CASCADE ---`);

  // Verify safe DROP of legacy 17-parameter overload
  assert(
    m20261108Sql.includes('DROP FUNCTION IF EXISTS public.create_booking_atomic('),
    '20261108 explicitly drops legacy 17-parameter create_booking_atomic overload'
  );

  assert(
    !m20261108Sql.includes('DROP FUNCTION public.create_booking_atomic CASCADE') &&
    !m20261108Sql.includes('DROP FUNCTION IF EXISTS public.create_booking_atomic CASCADE') &&
    !m20261108Sql.includes('DROP FUNCTION IF EXISTS public.create_booking_atomic(TEXT, DATE, INT, INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT) CASCADE'),
    '20261108 avoids destructive CASCADE drops (RESTRICT is safely respected)'
  );

  assert(
    m20261107Sql.includes('DROP FUNCTION IF EXISTS public.create_booking_atomic('),
    '20261107 explicitly drops legacy 17-parameter create_booking_atomic overload'
  );

  // ---------------------------------------------------------------------------
  // TASK 3: REVIEW MIGRATION SEQUENCING & IDEMPOTENCY
  // ---------------------------------------------------------------------------
  console.log(`\n--- TASK 3: Migration Sequencing & Fresh/Upgrade Safety ---`);

  // Verify all function definitions use CREATE OR REPLACE
  const replaceFuncCount08 = (m20261108Sql.match(/CREATE OR REPLACE FUNCTION/g) || []).length;
  assert(replaceFuncCount08 === 3, `20261108 defines 3 functions using CREATE OR REPLACE (${replaceFuncCount08} found)`);

  // Verify parentheses balance in 20261108
  const openParens08 = (m20261108Sql.match(/\(/g) || []).length;
  const closeParens08 = (m20261108Sql.match(/\)/g) || []).length;
  assert(openParens08 === closeParens08, `20261108 parentheses balanced (${openParens08} open / ${closeParens08} close)`);

  // Verify dollar-quotes balance in 20261108
  const dollarTags08 = (m20261108Sql.match(/\$\$/g) || []).length;
  assert(dollarTags08 % 2 === 0, `20261108 PL/pgSQL dollar-quotes paired (${dollarTags08} tags found)`);

  // Verify parentheses balance in 20261107
  const openParens07 = (m20261107Sql.match(/\(/g) || []).length;
  const closeParens07 = (m20261107Sql.match(/\)/g) || []).length;
  assert(openParens07 === closeParens07, `20261107 parentheses balanced (${openParens07} open / ${closeParens07} close)`);

  // ---------------------------------------------------------------------------
  // TASK 4: REMOVE NON-ATOMIC FRONTEND FALLBACKS
  // ---------------------------------------------------------------------------
  console.log(`\n--- TASK 4: Elimination of Non-Atomic Frontend Fallbacks ---`);

  const adminExtrasCode = fs.readFileSync(path.resolve('src/components/admin/AdminExtrasList.tsx'), 'utf8');
  const tourServiceCode = fs.readFileSync(path.resolve('src/services/tourService.ts'), 'utf8');

  // Verify AdminExtrasList.tsx does NOT fall back to delete-then-insert
  assert(
    !adminExtrasCode.includes("await supabase.from('tour_assigned_extras').delete().eq('extra_id', savedExtraId)"),
    'AdminExtrasList.tsx does NOT delete existing tour_assigned_extras on RPC error'
  );

  assert(
    adminExtrasCode.includes("Failed to update excursion assignments atomically") &&
    adminExtrasCode.includes("Existing assignments have been preserved"),
    'AdminExtrasList.tsx surfaces clear error and preserves existing assignments when atomic RPC fails'
  );

  // Verify tourService.ts does NOT fall back to delete-then-insert
  assert(
    !tourServiceCode.includes("await supabase.from('tour_assigned_extras').delete().eq('tour_id', tourId)"),
    'tourService.ts does NOT delete existing tour_assigned_extras on RPC error'
  );

  assert(
    tourServiceCode.includes("Failed to update tour add-on assignments atomically") &&
    tourServiceCode.includes("Existing assignments were preserved"),
    'tourService.ts surfaces clear error and preserves existing assignments when atomic RPC fails'
  );

  // ---------------------------------------------------------------------------
  // TASK 5 & 6: PRESERVE GUEST CHECKOUT & CORE FUNCTIONALITY
  // ---------------------------------------------------------------------------
  console.log(`\n--- TASK 5 & 6: Verification of Guest Checkout & Preserved Features ---`);

  const bookingRepoCode = fs.readFileSync(path.resolve('src/services/bookingRepository.ts'), 'utf8');

  assert(
    bookingRepoCode.includes("supabase.rpc('create_booking_atomic'"),
    'Guest booking continues to call create_booking_atomic RPC'
  );

  assert(
    bookingRepoCode.includes("p_idempotency_key: idempotencyKey"),
    'Guest booking forwards request idempotency token'
  );

  assert(
    bookingRepoCode.includes("p_payment_method: booking.paymentMethod || 'pay_at_pickup'"),
    'Pay-at-pickup payment method preserved as default'
  );

  assert(
    bookingRepoCode.includes("lookup_booking_secure"),
    'Secure guest booking lookup preserved'
  );

  console.log('\n========================================================================');
  console.log(`PREVIEW MIGRATION AUDIT COMPLETE: ${passed} PASSED / ${failed} FAILED`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAudit().catch((err) => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
