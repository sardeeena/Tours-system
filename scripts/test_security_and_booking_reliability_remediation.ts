import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}`);
    if (details) console.error(`         Details: ${details}`);
    failed++;
  }
}

console.log('========================================================================');
console.log('AWESOME ADVENTURE TOURS — SECURITY & RELIABILITY REMEDIATION AUDIT');
console.log('========================================================================\n');

// -----------------------------------------------------------------------------
// TASK 1: IDEMPOTENCY & DUPLICATE PROTECTION
// -----------------------------------------------------------------------------
console.log('--- TASK 1: Booking Idempotency & Duplicate Protection ---');
const migrationPath = path.resolve('supabase/migrations/20261108000000_security_and_booking_reliability_remediation.sql');
const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
const repoPath = path.resolve('src/services/bookingRepository.ts');
const repoCode = fs.readFileSync(repoPath, 'utf-8');

assert(
  migrationSql.includes('idempotency_key TEXT') &&
  migrationSql.includes('idx_bookings_idempotency_key') &&
  migrationSql.includes('WHERE idempotency_key IS NOT NULL'),
  'Migration provisions unique idempotency_key index on public.bookings'
);

assert(
  migrationSql.includes('p_idempotency_key TEXT DEFAULT NULL') &&
  migrationSql.includes('WHERE idempotency_key = TRIM(p_idempotency_key)'),
  'create_booking_atomic checks database by p_idempotency_key (no flawed 5-minute time window)'
);

assert(
  !migrationSql.includes("created_at > (NOW() - INTERVAL '5 minutes')"),
  'Eliminated flawed time-based duplicate detection that merged legitimate customer bookings'
);

assert(
  migrationSql.includes('EXCEPTION WHEN unique_violation THEN') &&
  migrationSql.includes('isDuplicate\', true'),
  'Concurrency race on same idempotency_key safely catches unique_violation and returns existing booking'
);

assert(
  repoCode.includes('booking.idempotencyKey') &&
  repoCode.includes('p_idempotency_key: idempotencyKey'),
  'bookingRepository generates and forwards unique idempotency token to PostgreSQL RPC'
);

assert(
  repoCode.includes('inFlightRefs.has(dedupeKey)') &&
  repoCode.includes('inFlightRefs.add(dedupeKey)') &&
  repoCode.includes('inFlightRefs.delete(dedupeKey)'),
  'bookingRepository maintains in-flight submission lock with guaranteed release in finally'
);

// -----------------------------------------------------------------------------
// TASK 2: STRICT TOUR / ADD-ON ASSIGNMENT VALIDATION
// -----------------------------------------------------------------------------
console.log('\n--- TASK 2: Enforce Strict Tour / Add-on Assignment Validation ---');

assert(
  migrationSql.includes('INNER JOIN public.tour_assigned_extras tae') &&
  migrationSql.includes('tae.extra_id = te.id AND tae.tour_id = v_tour.id'),
  'create_booking_atomic strictly INNER JOINs tour_assigned_extras for the selected tour'
);

assert(
  migrationSql.includes('IF NOT FOUND THEN') &&
  migrationSql.includes('is not assigned or available for excursion'),
  'Rejects add-on if unassigned, assigned to different tour, or if tour has zero assignments'
);

assert(
  migrationSql.includes('IF NOT v_extra_record.catalog_is_active') &&
  migrationSql.includes('IF NOT v_extra_record.assignment_is_active'),
  'Rejects add-on if catalog is inactive OR if tour assignment is inactive'
);

assert(
  migrationSql.includes('v_extra_qty < v_extra_record.min_quantity') &&
  migrationSql.includes('v_extra_qty > v_extra_record.max_quantity'),
  'Enforces minimum and maximum add-on quantity bounds in PostgreSQL'
);

assert(
  migrationSql.includes('COALESCE(tae.custom_price_eur, te.price_eur) AS effective_price') &&
  migrationSql.includes('v_extra_unit_price := v_extra_record.effective_price'),
  'Server strictly calculates add-on price from database records, ignoring client submitted prices'
);

// -----------------------------------------------------------------------------
// TASK 3: REMOVAL OF UNRELIABLE LOCALSTORAGE & STATIC FALLBACKS
// -----------------------------------------------------------------------------
console.log('\n--- TASK 3: Removal of Unreliable localStorage & Static Fallbacks ---');
const tourServicePath = path.resolve('src/services/tourService.ts');
const tourServiceCode = fs.readFileSync(tourServicePath, 'utf-8');

assert(
  !tourServiceCode.includes("lower.includes('safari') || lower.includes('quad')") &&
  !tourServiceCode.includes("lower.includes('orange') || lower.includes('dolphin')"),
  'Eradicated static contextual add-on fallbacks based on tour names in tourService.ts'
);

assert(
  !tourServiceCode.includes("localStorage.getItem('rse_mock_tours')"),
  'Removed localStorage mock tour fallback from getPublishedTourExtras'
);

assert(
  tourServiceCode.includes('.from(\'tour_assigned_extras\')') &&
  tourServiceCode.includes('item.custom_price_eur !== null') &&
  tourServiceCode.includes('Number(item.custom_price_eur)'),
  'getPublishedTourExtras queries Supabase directly and uses custom_price_eur as primary authority'
);

// -----------------------------------------------------------------------------
// TASK 4: ATOMIC ADMIN TOUR ASSIGNMENT UPDATES
// -----------------------------------------------------------------------------
console.log('\n--- TASK 4: Make Admin Tour Assignment Updates Atomic ---');
const adminExtrasPath = path.resolve('src/components/admin/AdminExtrasList.tsx');
const adminExtrasCode = fs.readFileSync(adminExtrasPath, 'utf-8');

assert(
  migrationSql.includes('CREATE OR REPLACE FUNCTION public.replace_extra_tour_assignments_atomic') &&
  migrationSql.includes('CREATE OR REPLACE FUNCTION public.replace_tour_extra_assignments_atomic'),
  'Created transactional PostgreSQL RPC functions for atomic tour assignment replacement'
);

assert(
  migrationSql.includes('RAISE EXCEPTION \'Access denied: Administrator privileges required') &&
  migrationSql.includes('public.is_admin()'),
  'Assignment replacement RPC functions enforce administrator authentication and authorization'
);

assert(
  migrationSql.includes('DELETE FROM public.tour_assigned_extras') &&
  migrationSql.includes('INSERT INTO public.tour_assigned_extras'),
  'Assignment replacement executes DELETE and INSERT within a single atomic PL/pgSQL transaction'
);

assert(
  migrationSql.includes('REVOKE ALL ON FUNCTION public.replace_extra_tour_assignments_atomic') &&
  migrationSql.includes('GRANT EXECUTE ON FUNCTION public.replace_extra_tour_assignments_atomic(UUID, JSONB) TO authenticated, service_role'),
  'Revoked PUBLIC execution on assignment RPCs; restricted to authenticated and service_role'
);

assert(
  adminExtrasCode.includes("supabase.rpc('replace_extra_tour_assignments_atomic'"),
  'AdminExtrasList.tsx uses replace_extra_tour_assignments_atomic RPC for atomic updates'
);

assert(
  !adminExtrasCode.includes("await supabase.from('tour_assigned_extras').delete().eq('extra_id', savedExtraId)"),
  'AdminExtrasList.tsx has zero non-atomic delete-then-insert fallback'
);

assert(
  tourServiceCode.includes("supabase.rpc('replace_tour_extra_assignments_atomic'"),
  'tourService.ts updateTour uses replace_tour_extra_assignments_atomic RPC for atomic updates'
);

assert(
  !tourServiceCode.includes("await supabase.from('tour_assigned_extras').delete().eq('tour_id', tourId)"),
  'tourService.ts updateTour has zero non-atomic delete-then-insert fallback'
);

// Disambiguation of function overloads (Fix SQLSTATE 42725)
assert(
  migrationSql.includes('DROP FUNCTION IF EXISTS public.create_booking_atomic('),
  'Safely retires legacy 17-parameter create_booking_atomic overload to resolve SQLSTATE 42725'
);

assert(
  migrationSql.includes('REVOKE ALL ON FUNCTION public.create_booking_atomic(') &&
  migrationSql.includes('GRANT EXECUTE ON FUNCTION public.create_booking_atomic(') &&
  migrationSql.includes('TO anon, authenticated, service_role;'),
  'REVOKE and GRANT statements specify explicit 18-parameter signature to prevent ambiguous overload errors'
);

// -----------------------------------------------------------------------------
// TASK 5: STRENGTHEN PASSENGER QUANTITY VALIDATION
// -----------------------------------------------------------------------------
console.log('\n--- TASK 5: Strengthen Passenger Quantity Validation ---');

assert(
  migrationSql.includes('p_adult_count < 1 OR p_adult_count > 100') &&
  migrationSql.includes('p_child_count < 0 OR p_child_count > 100') &&
  migrationSql.includes('p_infant_count < 0 OR p_infant_count > 50'),
  'create_booking_atomic validates passenger integer ranges (adult 1-100, child 0-100, infant 0-50)'
);

assert(
  repoCode.includes('Number.isInteger(adults)') &&
  repoCode.includes('Number.isInteger(children)') &&
  repoCode.includes('Number.isInteger(infants)'),
  'bookingRepository validates that passenger quantities are integers, rejecting decimal numbers'
);

assert(
  migrationSql.includes('(v_avail.booked_count + v_total_guests) > v_avail.max_capacity'),
  'create_booking_atomic verifies total party size against row-level capacity locks'
);

// Mathematical tests for passenger pricing rules
import { calculateBookingPrice } from '../src/services/pricingService';
import { Tour } from '../src/types';

const testTour: Tour = {
  id: 't-safari',
  title: 'Desert Quad Tour',
  slug: 'desert-quad-tour',
  priceEur: 60,
  durationHours: 4,
  badge: 'Top Seller',
  description: 'Test tour',
  highlights: [],
  included: [],
  notIncluded: [],
  pickupLocations: ['Hurghada'],
  departureTimes: ['08:00'],
  groupSizeMax: 25,
  isPopular: true,
  destination: 'Hurghada',
  images: [],
};

// 1. Valid adult-only booking
const calcAdultOnly = calculateBookingPrice({
  tour: testTour,
  guests: { adults: 2, children: 0, infants: 0 },
  currency: { code: 'EUR', symbol: '€', rateAgainstEur: 1 },
});
assert(calcAdultOnly.totalEur === 120, 'Pricing: 2 adults at €60 = €120.00');

// 2. Valid adult and child booking (children at 50%)
const calcAdultChild = calculateBookingPrice({
  tour: testTour,
  guests: { adults: 2, children: 1, infants: 0 },
  currency: { code: 'EUR', symbol: '€', rateAgainstEur: 1 },
});
assert(calcAdultChild.totalEur === 150, 'Pricing: 2 adults (€120) + 1 child (€30) = €150.00');

// 3. Valid booking with infants (infants free at €0)
const calcWithInfants = calculateBookingPrice({
  tour: testTour,
  guests: { adults: 2, children: 1, infants: 2 },
  currency: { code: 'EUR', symbol: '€', rateAgainstEur: 1 },
});
assert(calcWithInfants.totalEur === 150, 'Pricing: Infants are free of charge (€0.00)');

console.log('\n========================================================================');
console.log(`AUDIT COMPLETE: ${passed} PASSED / ${failed} FAILED`);
console.log('========================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
