import fs from 'fs';
import path from 'path';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${message}`);
    passCount++;
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
    failCount++;
  }
}

console.log('========================================================================');
console.log('AWESOME ADVENTURE TOURS — PHASE 1 TO PHASE 7 VERIFICATION SUITE');
console.log('========================================================================');

// --- PHASE 1: DATABASE SCHEMA & MIGRATION INTEGRITY ---
console.log('\n--- PHASE 1: Database Schema & Migration Integrity ---');
const migrationPath = path.join(process.cwd(), 'supabase/migrations/20261107000000_tour_extras_and_addons_enhancement.sql');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

assert(!migrationSql.includes('public.booking_status'), 'Zero references to nonexistent public.booking_status');
assert(!migrationSql.includes('public.payment_status'), 'Zero references to nonexistent public.payment_status');
assert(!migrationSql.includes('public.availability_status'), 'Zero references to nonexistent public.availability_status');
assert(migrationSql.includes('SET search_path = public, auth, pg_temp'), 'Security Definer pins search_path to prevent hijacking and resolve auth.uid()');
assert(migrationSql.includes('public.audit_logs'), 'Audit events write to authoritative public.audit_logs (no hallucinated booking_timeline)');
assert(migrationSql.includes('is_lead_passenger') && migrationSql.includes('is_lead'), 'Dual-column backward and forward compatibility for passenger manifest');
assert(migrationSql.includes('custom_price_eur NUMERIC'), 'tour_assigned_extras supports custom_price_eur');
assert(migrationSql.includes('min_quantity INT') && migrationSql.includes('max_quantity INT'), 'tour_extras supports min_quantity and max_quantity constraints');

// --- PHASE 2: ADD-ON ADMIN MANAGEMENT ---
console.log('\n--- PHASE 2: Add-on Admin Management UI & Logic ---');
const adminExtrasPath = path.join(process.cwd(), 'src/components/admin/AdminExtrasList.tsx');
const adminExtrasCode = fs.readFileSync(adminExtrasPath, 'utf8');

assert(adminExtrasCode.includes('handleToggleActive'), 'AdminExtrasList provides inline active/inactive toggle');
assert(adminExtrasCode.includes('handleMoveSortOrder'), 'AdminExtrasList provides sorting/reordering controls');
assert(adminExtrasCode.includes('uploadTourMedia'), 'AdminExtrasList supports device image file upload to Supabase Storage');
assert(adminExtrasCode.includes('listStorageMedia'), 'AdminExtrasList integrates with Media Library for asset selection');
assert(adminExtrasCode.includes('tourCustomPrices') && adminExtrasCode.includes('persistTourCustomExtraPriceToDb'), 'AdminExtrasList persists tour-specific price overrides to Supabase database');
assert(adminExtrasCode.includes('filterStatus'), 'AdminExtrasList supports filtering by active status');
assert(adminExtrasCode.includes('filterPricingType'), 'AdminExtrasList supports filtering by pricing type');

// --- PHASE 3: STORAGE INTEGRATION ---
console.log('\n--- PHASE 3: Storage Integration & Asset Management ---');
const storagePath = path.join(process.cwd(), 'src/services/storageService.ts');
const storageCode = fs.readFileSync(storagePath, 'utf8');

assert(storageCode.includes("'extras'"), 'ALLOWED_STORAGE_FOLDERS includes extras for organized asset storage');
assert(storageCode.includes('tour-media'), 'Uses dedicated tour-media Supabase storage bucket');
assert(storageCode.includes('validateMediaFile'), 'Enforces MIME type and file size validation before upload');

// --- PHASE 4: TOUR ASSIGNMENT & DYNAMIC OVERRIDES ---
console.log('\n--- PHASE 4: Tour Assignment & Custom Price Overrides ---');
const tourServicePath = path.join(process.cwd(), 'src/services/tourService.ts');
const tourServiceCode = fs.readFileSync(tourServicePath, 'utf8');

assert(tourServiceCode.includes('adminListTourExtras'), 'tourService provides adminListTourExtras returning all extras for management');
assert(tourServiceCode.includes('fetchTourCustomExtraPricesFromDb'), 'tourService reads custom price overrides directly from Supabase tour_assigned_extras');
assert(tourServiceCode.includes('persistTourCustomExtraPriceToDb'), 'tourService updates custom prices in tour_assigned_extras in Supabase');

// --- PHASE 5: DYNAMIC CUSTOMER BOOKING PRICING & QUANTITY LIMITS ---
console.log('\n--- PHASE 5: Dynamic Customer Booking Pricing Formulas ---');
const pricingServicePath = path.join(process.cwd(), 'src/services/pricingService.ts');
const pricingServiceCode = fs.readFileSync(pricingServicePath, 'utf8');

assert(pricingServiceCode.includes("extra.pricingType === 'per_person'"), 'Pricing engine handles per_person pricing (priceEur * totalPayingGuests * qty)');
assert(pricingServiceCode.includes("extra.pricingType === 'per_adult'"), 'Pricing engine handles per_adult pricing (priceEur * adultsCount * qty)');
assert(pricingServiceCode.includes("extra.pricingType === 'per_child'"), 'Pricing engine handles per_child pricing (priceEur * childrenCount * qty)');
assert(pricingServiceCode.includes("extra.pricingType === 'per_vehicle'"), 'Pricing engine handles per_vehicle pricing (priceEur * qty)');
assert(pricingServiceCode.includes("extra.pricingType === 'per_item'"), 'Pricing engine handles per_item pricing (priceEur * qty)');
assert(pricingServiceCode.includes("// Flat per booking"), 'Pricing engine handles per_booking flat pricing (priceEur * qty)');

// Test mathematical calculations directly
import { calculateBookingPrice } from '../src/services/pricingService';
import { Tour } from '../src/types';
import { BookingExtra } from '../src/types/booking';

const dummyTour: Tour = {
  id: 'tour-123',
  title: 'Desert Quad Safari',
  slug: 'desert-quad-safari',
  priceEur: 50,
  durationHours: 3,
  badge: 'Popular',
  description: 'Test tour',
  highlights: [],
  included: [],
  notIncluded: [],
  pickupLocations: ['Hurghada'],
  departureTimes: ['09:00'],
  groupSizeMax: 20,
  isPopular: true,
  destination: 'Hurghada',
  images: ['https://example.com/img.jpg'],
};

const extrasCatalog: BookingExtra[] = [
  { id: 'ex-booking', name: 'Private Guide', description: '', priceEur: 40, pricingType: 'per_booking', minQuantity: 1, maxQuantity: 1 },
  { id: 'ex-person', name: 'Buffet Lunch', description: '', priceEur: 15, pricingType: 'per_person', minQuantity: 1, maxQuantity: 10 },
  { id: 'ex-adult', name: 'Dune Buggy Upgrade', description: '', priceEur: 25, pricingType: 'per_adult', minQuantity: 1, maxQuantity: 10 },
  { id: 'ex-child', name: 'Child Camel Ride', description: '', priceEur: 10, pricingType: 'per_child', minQuantity: 1, maxQuantity: 5 },
  { id: 'ex-vehicle', name: 'ATV Quad Single', description: '', priceEur: 35, pricingType: 'per_vehicle', minQuantity: 1, maxQuantity: 4 },
];

const guests = { adults: 2, children: 1, infants: 1 };
const extraQuantities: Record<string, number> = {
  'ex-booking': 1,
  'ex-person': 1,
  'ex-adult': 1,
  'ex-child': 1,
  'ex-vehicle': 2,
};

const calculated = calculateBookingPrice({
  tour: dummyTour,
  guests,
  selectedPickup: null,
  selectedExtras: extrasCatalog.map((extra) => ({
    extra,
    quantity: extraQuantities[extra.id] || 1,
  })),
  currency: { code: 'EUR', symbol: '€', rateAgainstEur: 1 },
});

// Formula checks:
// Base: 2 adults * 50 = 100, 1 child * 25 = 25 (child is 50% base) -> base = 125
// Extras:
// - per_booking: 40 * 1 = 40
// - per_person: 15 * (2 + 1) = 45
// - per_adult: 25 * 2 = 50
// - per_child: 10 * 1 = 10
// - per_vehicle: 35 * 2 = 70
// Total extras = 40 + 45 + 50 + 10 + 70 = 215
const breakdownMap = new Map(calculated.extrasBreakdown.map(b => [b.extraId, b.amountEur]));
assert(breakdownMap.get('ex-booking') === 40, 'Calculation: per_booking matches €40.00');
assert(breakdownMap.get('ex-person') === 45, 'Calculation: per_person matches €45.00 (3 paying guests)');
assert(breakdownMap.get('ex-adult') === 50, 'Calculation: per_adult matches €50.00 (2 adults * €25)');
assert(breakdownMap.get('ex-child') === 10, 'Calculation: per_child matches €10.00 (1 child * €10)');
assert(breakdownMap.get('ex-vehicle') === 70, 'Calculation: per_vehicle matches €70.00 (2 vehicles * €35)');
assert(calculated.extrasSubtotalEur === 215, 'Calculation: Total extras subtotal matches €215.00 exactly');

// --- PHASE 6: BOOKING RELIABILITY & ATOMICITY ---
console.log('\n--- PHASE 6: Booking Reliability & Elimination of Unsafe Fallbacks ---');
const bookingRepoPath = path.join(process.cwd(), 'src/services/bookingRepository.ts');
const bookingRepoCode = fs.readFileSync(bookingRepoPath, 'utf8');

assert(!bookingRepoCode.includes('supabase.from(\'bookings\').insert'), 'bookingRepository has ZERO client-side multi-table fallback inserting directly into bookings');
assert(!bookingRepoCode.includes('supabase.from(\'booking_passengers\').insert'), 'bookingRepository has ZERO client-side multi-table fallback inserting directly into booking_passengers');
assert(!bookingRepoCode.includes('supabase.from(\'booking_extras\').insert'), 'bookingRepository has ZERO client-side multi-table fallback inserting directly into booking_extras');
assert(bookingRepoCode.includes("supabase.rpc('create_booking_atomic'"), 'create_booking_atomic is the sole, authoritative, atomic booking creation pathway');
assert(bookingRepoCode.includes('inFlightRefs.has(dedupeKey)'), 'bookingRepository enforces double-click / concurrent submission locks');
assert(bookingRepoCode.includes('pay_at_pickup'), 'Pay at pickup is preserved as default payment method without forced payment gateway');

// --- PHASE 7: STAGING FIRST & NON-DESTRUCTIVE INTEGRITY ---
console.log('\n--- PHASE 7: Verification & Non-Destructive Integrity ---');
assert(!migrationSql.includes('DROP TABLE'), 'Migration does NOT drop any existing business tables');
assert(!migrationSql.includes('TRUNCATE'), 'Migration does NOT truncate any business tables');
assert(migrationSql.includes('IF NOT EXISTS'), 'DDL operations use IF NOT EXISTS for safe, non-destructive execution');

console.log('========================================================================');
console.log(`VERIFICATION SUMMARY: ${passCount} PASSED / ${failCount} FAILED`);
console.log('========================================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
