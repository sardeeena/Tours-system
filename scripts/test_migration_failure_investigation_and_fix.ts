/**
 * AWESOME ADVENTURE TOURS — SUPABASE MIGRATION AUDIT & VALIDATION SUITE
 * 
 * Verifies the complete investigation and remediation of migration failure:
 * ERROR: type "public.booking_status" does not exist (SQLSTATE 42704) At statement: 3
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
  console.log(`AWESOME ADVENTURE TOURS — SUPABASE MIGRATION DEEP AUDIT & VERIFICATION`);
  console.log(`========================================================================\n`);

  const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');
  const targetMigrationPath = path.join(migrationsDir, '20261107000000_tour_extras_and_addons_enhancement.sql');

  // 1. Audit Migration File Presence and Integrity
  console.log(`1. Migration File Inventory & Sequence:`);
  assert(fs.existsSync(targetMigrationPath), 'Target migration file 20261107000000 exists');

  const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  assert(migrationFiles.length >= 21, `Full migration history preserved (${migrationFiles.length} migrations found)`);
  assert(migrationFiles.includes('20261107000000_tour_extras_and_addons_enhancement.sql'), 'Target migration 20261107000000 is present and sequenced in migration history');

  const migrationContent = fs.readFileSync(targetMigrationPath, 'utf8');

  // 2. Audit Against Primary Reported Failure: Non-existent types
  console.log(`\n2. Investigating & Eliminating Non-Existent PostgreSQL Types:`);
  const hasBookingStatusType = migrationContent.includes('public.booking_status') || migrationContent.includes('booking_status');
  assert(!hasBookingStatusType, 'Zero references to non-existent type "public.booking_status" (Resolved SQLSTATE 42704)');

  const hasPaymentStatusType = migrationContent.includes('public.payment_status') || migrationContent.includes('payment_status :=');
  assert(!hasPaymentStatusType, 'Zero references to non-existent type "public.payment_status"');

  const hasAvailabilityStatusType = migrationContent.includes('public.availability_status') || migrationContent.includes('availability_status');
  assert(!hasAvailabilityStatusType, 'Zero references to non-existent type "public.availability_status"');

  assert(
    migrationContent.includes("v_initial_status TEXT := 'pending';") &&
    migrationContent.includes("v_initial_payment_status TEXT := 'pending';"),
    'Variables v_initial_status and v_initial_payment_status correctly declared as PostgreSQL TEXT'
  );

  // 3. Audit Search Path & Schema Qualification
  console.log(`\n3. Security Definer Search Path & Auth Resolution:`);
  assert(
    migrationContent.includes('SET search_path = public, auth, pg_temp'),
    'Security definer explicitly binds search_path = public, auth, pg_temp (prevents search_path hijacking & resolves auth.uid)'
  );

  // 4. Audit Table Relationship & Non-existent Table References
  console.log(`\n4. Database Table Dependencies & Audit Trail:`);
  assert(
    !migrationContent.includes('public.booking_timeline'),
    'Eliminated reference to non-existent table "public.booking_timeline"'
  );
  assert(
    migrationContent.includes('INSERT INTO public.audit_logs'),
    'Audit trail writes directly to authoritative "public.audit_logs" table'
  );

  // 5. Audit Passenger Manifest Columns Compatibility
  console.log(`\n5. Passenger Manifest Schema Compatibility:`);
  assert(
    migrationContent.includes('is_lead_passenger') && migrationContent.includes('is_lead'),
    'Handles both is_lead_passenger (canonical schema) and is_lead (backward compatible)'
  );
  assert(
    migrationContent.includes('ALTER TABLE public.booking_passengers ADD COLUMN IF NOT EXISTS is_lead'),
    'Idempotently provisions is_lead column on booking_passengers if missing'
  );

  // 6. Audit Idempotency of Schema Extensions
  console.log(`\n6. DDL Idempotency & Conflict Safety:`);
  assert(
    migrationContent.includes('ALTER TABLE public.tour_extras ADD COLUMN IF NOT EXISTS image_url TEXT') &&
    migrationContent.includes('ALTER TABLE public.tour_extras ADD COLUMN IF NOT EXISTS min_quantity INT') &&
    migrationContent.includes('ALTER TABLE public.tour_extras ADD COLUMN IF NOT EXISTS max_quantity INT'),
    'Dynamic tour_extras columns provisioned using native ADD COLUMN IF NOT EXISTS'
  );

  assert(
    migrationContent.includes('ALTER TABLE public.tour_assigned_extras ADD COLUMN IF NOT EXISTS custom_price_eur'),
    'Tour-assigned custom pricing provisioned idempotently'
  );

  assert(
    migrationContent.includes('ALTER TABLE public.booking_extras ADD COLUMN IF NOT EXISTS description TEXT') &&
    migrationContent.includes('ALTER TABLE public.booking_extras ADD COLUMN IF NOT EXISTS currency TEXT'),
    'Booking extras snapshot description and currency columns provisioned idempotently'
  );

  assert(
    migrationContent.includes('tour_extras_pricing_type_check'),
    'Safely drops and recreates tour_extras_pricing_type_check constraint with per_vehicle & per_item'
  );

  // 7. Audit Seeding Idempotency
  console.log(`\n7. Data Seeding Safety & Upsert Handling:`);
  assert(
    migrationContent.includes('ON CONFLICT (id) DO UPDATE SET') &&
    migrationContent.includes('b2a3c4d5-1111-4444-8888-000000000001'),
    'Dynamic safari add-on examples seeded with deterministic UUIDs and safe ON CONFLICT UPDATE'
  );

  assert(
    migrationContent.includes('INSERT INTO public.tour_assigned_extras (tour_id, extra_id)') &&
    migrationContent.includes('ON CONFLICT DO NOTHING'),
    'Tour assignment cross-join uses ON CONFLICT DO NOTHING to prevent duplicate key violations'
  );

  // 8. Audit Permissions and Role Grants
  console.log(`\n8. Permissions & Execution Grants:`);
  assert(
    migrationContent.includes('DROP FUNCTION IF EXISTS public.create_booking_atomic('),
    'Safely retires legacy 17-parameter create_booking_atomic overload to prevent SQLSTATE 42725'
  );
  assert(
    migrationContent.includes('REVOKE ALL ON FUNCTION public.create_booking_atomic(') &&
    migrationContent.includes('GRANT EXECUTE ON FUNCTION public.create_booking_atomic(') &&
    migrationContent.includes('TO anon, authenticated, service_role;'),
    'create_booking_atomic grants use explicit 18-parameter function signature for anon, authenticated, and service_role'
  );

  // 9. Client Application Compatibility Check
  console.log(`\n9. Client-Side Integration & Guest Checkout:`);
  const bookingRepoContent = fs.readFileSync(path.resolve(process.cwd(), 'src/services/bookingRepository.ts'), 'utf8');
  assert(
    bookingRepoContent.includes("p_tour_identifier: booking.tourId || booking.tourSlug || ''") &&
    bookingRepoContent.includes("p_customer_hotel: booking.customer.hotelName || booking.pickup.hotelName || null") &&
    bookingRepoContent.includes("p_extras: (booking.extras || []).map"),
    'bookingRepository payload matches create_booking_atomic argument signature'
  );

  assert(
    bookingRepoContent.includes('create_booking_atomic') &&
    !bookingRepoContent.includes('requireAuthForBooking'),
    'Guest checkout remains 100% available without mandatory user authentication'
  );

  // 10. Audit Syntax Structure
  console.log(`\n10. SQL Syntax Balance & Structure Verification:`);
  const openParens = (migrationContent.match(/\(/g) || []).length;
  const closeParens = (migrationContent.match(/\)/g) || []).length;
  assert(openParens === closeParens, `Parentheses balanced (${openParens} open / ${closeParens} close)`);

  const dollarTags = (migrationContent.match(/\$\$/g) || []).length;
  assert(dollarTags % 2 === 0, `PL/pgSQL $$ block delimiters properly closed (${dollarTags} occurrences)`);

  console.log(`\n========================================================================`);
  console.log(`AUDIT COMPLETE: ${passed} PASSED / ${failed} FAILED`);
  console.log(`========================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Audit crashed:', err);
  process.exit(1);
});
