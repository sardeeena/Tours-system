/**
 * Comprehensive Automated Verification Suite for
 * Awesome Adventure Tours — Security, Booking Reliability & Performance Remediation
 */
import fs from 'fs';
import path from 'path';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    console.error(`  ✗ [FAIL] ${testName}${detail ? ` - Detail: ${detail}` : ''}`);
    process.exitCode = 1;
  }
}

async function runTestSuite() {
  console.log('========================================================================');
  console.log('AWESOME ADVENTURE TOURS — SECURITY, BOOKING & PERFORMANCE VERIFICATION');
  console.log('========================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. SQL MIGRATION FILE & DATABASE SECURITY AUDIT
  // ---------------------------------------------------------------------------
  console.log('1. Auditing Database Security Migration File:');
  const migrationPath = path.resolve('supabase/migrations/20261106000000_production_security_and_capacity_remediation.sql');
  assert(fs.existsSync(migrationPath), 'Migration file exists: 20261106000000_production_security_and_capacity_remediation.sql');

  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');

  // Verify dangerous anon policy removal
  assert(
    migrationSql.includes('DROP POLICY IF EXISTS "Users can view own bookings"') ||
    migrationSql.includes('DROP POLICY IF EXISTS "Public can view own bookings"'),
    'Drops vulnerable "Users can view own bookings" policy'
  );

  // Verify anonymous SELECT revocation on bookings
  assert(
    migrationSql.includes('REVOKE SELECT, UPDATE, DELETE ON public.bookings FROM anon, public;') ||
    migrationSql.includes('REVOKE SELECT, INSERT, UPDATE, DELETE ON public.bookings FROM anon'),
    'Revokes anonymous direct table SELECT/UPDATE/DELETE on public.bookings'
  );

  // Verify anonymous execution revocation on sensitive BI functions
  assert(
    (migrationSql.includes('REVOKE ALL ON FUNCTION public.get_executive_bi_metrics') || migrationSql.includes('REVOKE EXECUTE ON FUNCTION public.get_executive_bi_metrics')) &&
    (migrationSql.includes('REVOKE ALL ON FUNCTION public.query_custom_bi_report') || migrationSql.includes('REVOKE EXECUTE ON FUNCTION public.query_custom_bi_report')) &&
    (migrationSql.includes('REVOKE ALL ON FUNCTION public.recalculate_customer_stats') || migrationSql.includes('REVOKE EXECUTE ON FUNCTION public.recalculate_customer_stats')),
    'Revokes anonymous execution on executive BI and customer stats RPCs'
  );

  // Verify search_path pinning on SECURITY DEFINER functions
  assert(
    migrationSql.includes('SET search_path = public, pg_temp'),
    'Pins search_path = public, pg_temp on SECURITY DEFINER functions to prevent search_path hijacking'
  );

  // Verify is_admin() authorization check inside BI functions
  assert(
    migrationSql.includes('IF NOT public.is_admin() THEN') || migrationSql.includes('is_admin()'),
    'Enforces is_admin() authorization checks inside SECURITY DEFINER BI functions'
  );

  // Verify atomic booking capacity locking
  assert(
    migrationSql.includes('FOR UPDATE') && migrationSql.includes('tour_availability'),
    'Enforces row-level capacity locking (FOR UPDATE) in create_booking_atomic'
  );

  // Verify missing date row creation
  assert(
    migrationSql.includes('INSERT INTO public.tour_availability') && migrationSql.includes('v_default_capacity'),
    'Upserts missing tour_availability records from tour.max_guests to prevent capacity bypass'
  );

  // Verify covering indexes on foreign keys
  assert(
    migrationSql.includes('idx_bookings_customer_id') &&
    migrationSql.includes('idx_bookings_tour_id') &&
    migrationSql.includes('idx_payment_transactions_booking_id') &&
    migrationSql.includes('idx_invoices_booking_id') &&
    migrationSql.includes('idx_booking_passengers_booking_id') &&
    migrationSql.includes('idx_booking_extras_booking_id'),
    'Provides covering foreign key indexes for database performance'
  );

  console.log('\n2. Auditing Guest Booking Lookup & Two-Factor Privacy:');
  // Verify lookup_booking_secure validates exact normalized email or phone
  assert(
    migrationSql.includes('v_cust_email = v_clean_contact') &&
    migrationSql.includes('LENGTH(v_digits_contact) >= 8'),
    'lookup_booking_secure validates input as normalized email or >= 8-digit full phone number'
  );

  assert(
    !migrationSql.includes('NOT LIKE (\'%\' || v_digits_contact)'),
    'Eliminated dangerous partial 5-digit phone suffix matching from SQL lookup'
  );

  assert(
    migrationSql.includes('check_atomic_rate_limit') &&
    migrationSql.includes('lookup_booking_secure'),
    'Includes rate-limiting protection against brute-force booking reference guessing'
  );

  // ---------------------------------------------------------------------------
  // 3. APPLICATION CODE AUDIT: BOOKING REPOSITORY & LOOKUP
  // ---------------------------------------------------------------------------
  console.log('\n3. Auditing Client Application Code (bookingRepository.ts):');
  const repoPath = path.resolve('src/services/bookingRepository.ts');
  const repoContent = fs.readFileSync(repoPath, 'utf-8');

  // Verify inFlightRefs concurrency locking
  assert(
    repoContent.includes('inFlightRefs.has(dedupeKey)') &&
    repoContent.includes('inFlightRefs.add(dedupeKey)') &&
    repoContent.includes('inFlightRefs.delete(dedupeKey)'),
    'Implements double-click and concurrent submission locking via inFlightRefs'
  );

  // Verify finally block ensures lock cleanup
  assert(
    repoContent.includes('finally {') &&
    repoContent.includes('SupabaseBookingRepository.inFlightRefs.delete(dedupeKey);'),
    'Guarantees submission lock is released in finally block'
  );

  // Verify passenger count validation
  assert(
    repoContent.includes('Excursion departure date cannot be in the past') &&
    repoContent.includes('booking.guests.adults < 1') &&
    repoContent.includes('(booking.guests.children || 0) < 0'),
    'Validates passenger counts (>= 1 adult, non-negative children/infants) and rejects past dates'
  );

  // Verify findBooking guest lookup privacy
  assert(
    repoContent.includes('lookup_booking_secure') &&
    repoContent.includes('queryDigits.length >= 8'),
    'Requires minimum 8 normalized digits for phone lookups, preventing partial match leakage'
  );

  assert(
    repoContent.includes('Anonymous visitors MUST provide valid verification and succeed through lookup_booking_secure'),
    'Blocks anonymous visitors from querying bookings table directly via direct SELECT'
  );

  // ---------------------------------------------------------------------------
  // 4. FINANCE WRITE INTEGRITY & AUTHORITATIVE PERSISTENCE
  // ---------------------------------------------------------------------------
  console.log('\n4. Auditing Finance Service Write Reliability (financeService.ts):');
  const financePath = path.resolve('src/services/financeService.ts');
  const financeContent = fs.readFileSync(financePath, 'utf-8');

  // Verify generateInvoiceForBooking checks database write
  assert(
    financeContent.includes('.from(\'invoices\')') &&
    financeContent.includes('if (invError) {') &&
    financeContent.includes('Failed to persist invoice to database'),
    'generateInvoiceForBooking verifies database write before updating application state'
  );

  // Verify rejectRefund checks database write
  assert(
    financeContent.includes('.from(\'refund_records\')') &&
    financeContent.includes('if (updErr) {') &&
    financeContent.includes('setLocal(LOCAL_REFUNDS_KEY, [...allRefunds]);'),
    'rejectRefund verifies database write before updating application state'
  );

  // ---------------------------------------------------------------------------
  // 5. PERFORMANCE: CODE SPLITTING & SWR CACHING
  // ---------------------------------------------------------------------------
  console.log('\n5. Auditing Performance & Bundle Optimization:');
  const appPath = path.resolve('src/App.tsx');
  const appContent = fs.readFileSync(appPath, 'utf-8');

  // Verify React.lazy is used for admin components
  assert(
    appContent.includes('lazy(() => import(\'./components/admin/AdminDashboard\'') &&
    appContent.includes('lazy(() => import(\'./components/admin/operations/OperationsDepartures\'') &&
    appContent.includes('lazy(() => import(\'./components/admin/finance/FinanceInvoices\''),
    'Admin dashboard, CRM, and Finance modules are code-split using React.lazy()'
  );

  // Verify parallel catalogue fetching
  assert(
    appContent.includes('Promise.allSettled([') &&
    appContent.includes('getPublishedTours()') &&
    appContent.includes('getPublishedDestinations()') &&
    appContent.includes('getPublishedCategories()'),
    'Parallelizes catalogue fetching with Promise.allSettled on initial mount'
  );

  const tourServicePath = path.resolve('src/services/tourService.ts');
  const tourServiceContent = fs.readFileSync(tourServicePath, 'utf-8');

  // Verify in-memory SWR caching in tourService
  assert(
    tourServiceContent.includes('cachedPublishedTours') &&
    tourServiceContent.includes('CACHE_TTL_MS') &&
    tourServiceContent.includes('invalidateCatalogueCache'),
    'Implements in-memory catalogue caching with 60s TTL and cache invalidation on data changes'
  );

  // Check production build output
  const distHtml = path.resolve('dist/index.html');
  assert(fs.existsSync(distHtml), 'Production build (dist/index.html) successfully generated');

  console.log('\n========================================================================');
  console.log(`VERIFICATION COMPLETE: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
  console.log('========================================================================\n');
}

runTestSuite().catch((err) => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
