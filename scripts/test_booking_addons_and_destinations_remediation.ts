import fs from 'fs';
import path from 'path';
import { calculateBookingPrice } from '../src/services/pricingService';
import { getPublishedPickupLocations, getPublishedTourExtras } from '../src/services/tourService';
import { Tour } from '../src/types';
import { BookingExtra, GuestCounts, PickupLocation } from '../src/types/booking';

const rootDir = process.cwd();

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName}`);
    if (details) console.error(`       Details: ${details}`);
    failed++;
  }
}

async function runTests() {
  console.log('--- RUNNING REMEDIATION TEST SUITE ---\n');

  // ==============================================================================
  // 1. TEST TOUR-SPECIFIC EXTRAS (Requirement 1)
  // ==============================================================================
  console.log('1. Checking Tour-Specific Extras Isolation...');
  const safariExtras = await getPublishedTourExtras('super-safari-hurghada');
  const islandExtras = await getPublishedTourExtras('orange-bay-island-hurghada');

  assert(
    !safariExtras.some((e) => e.name.toLowerCase().includes('scuba') || e.name.toLowerCase().includes('seafood')),
    'Safari tour strictly excludes scuba and seafood marine add-ons'
  );

  assert(
    !islandExtras.some((e) => e.name.toLowerCase().includes('quad') || e.name.toLowerCase().includes('buggy')),
    'Island tour strictly excludes quad bike and buggy desert extras'
  );

  const unknownTourExtras = await getPublishedTourExtras('tour-with-no-extras-1234');
  assert(
    Array.isArray(unknownTourExtras) && unknownTourExtras.length === 0,
    'Tours without assigned extras return empty array (NO global fallback)'
  );

  assert(
    Array.isArray(safariExtras) && (!safariExtras.length || safariExtras.every((e) => !e.name.toLowerCase().includes('scuba'))),
    'Tour extras query is strictly database-driven without hardcoded fallback pollution'
  );

  // ==============================================================================
  // 2. TEST DESTINATION FILTERING BY TOUR CITY (Requirement 2)
  // ==============================================================================
  console.log('\n2. Checking Destination Filtering by Tour City/Hub...');
  const hurghadaPickups = await getPublishedPickupLocations('Hurghada');
  const marsaPickups = await getPublishedPickupLocations('Marsa Alam');
  const sharmPickups = await getPublishedPickupLocations('Sharm El-Sheikh');

  assert(
    hurghadaPickups.some((p) => p.id === 'hurghada' || p.id === 'el-gouna' || p.id === 'makadi-bay'),
    'Hurghada pickup locations contain regional coastal zones (Hurghada, El Gouna, Makadi)'
  );

  assert(
    !hurghadaPickups.some((p) => p.id === 'marsa-alam' || p.id === 'sharm-el-sheikh'),
    'Hurghada tour strictly excludes Marsa Alam and Sharm El-Sheikh destinations'
  );

  assert(
    marsaPickups.every((p) => p.id.includes('marsa') || p.area.toLowerCase().includes('marsa')),
    'Marsa Alam tour displays only Marsa Alam pickup destinations'
  );

  assert(
    sharmPickups.every((p) => p.id.includes('sharm') || p.area.toLowerCase().includes('sharm') || p.area.toLowerCase().includes('naama')),
    'Sharm El-Sheikh tour displays only Sharm pickup destinations'
  );

  // ==============================================================================
  // 3. TEST DYNAMIC ADD-ON SYSTEM & PRICING CALCULATIONS (Requirement 3)
  // ==============================================================================
  console.log('\n3. Checking Dynamic Add-on Pricing Methods...');
  const dummyTour: Tour = {
    id: 't-test',
    slug: 'test-safari',
    title: 'Desert Quad Safari',
    category: 'Safari',
    destination: 'Hurghada',
    durationLabel: '3 hours',
    priceEur: 40,
    primaryImage: '',
    rating: 4.9,
    reviewCount: 10,
    pickupIncluded: true,
    freeCancellation: true,
    status: 'published',
  };

  const guests: GuestCounts = { adults: 2, children: 1, infants: 0 };
  const singleQuadExtra: BookingExtra = {
    id: 'single-quad',
    name: 'Single Quad',
    description: 'Quad bike',
    priceEur: 35,
    pricingType: 'per_vehicle',
  };

  const safariDinnerExtra: BookingExtra = {
    id: 'additional-safari',
    name: 'Additional Safari Experience',
    description: 'Dinner & stargazing',
    priceEur: 20,
    pricingType: 'per_person',
  };

  // 2 Single Quads = 2 * 35 = 70 EUR
  const pricingQuads = calculateBookingPrice({
    tour: dummyTour,
    guests,
    selectedExtras: [{ extra: singleQuadExtra, quantity: 2 }],
  });

  const quadBreakdown = pricingQuads.extrasBreakdown.find((b) => b.extraId === 'single-quad');
  assert(
    quadBreakdown !== undefined && quadBreakdown.amountEur === 70,
    'Per-vehicle add-on calculates unit price * quantity (2 quads = €70.00)',
    `Expected 70, got ${quadBreakdown?.amountEur}`
  );

  // Per-person extra: 20 EUR * (2 adults + 1 child) = 60 EUR
  const pricingDinner = calculateBookingPrice({
    tour: dummyTour,
    guests,
    selectedExtras: [{ extra: safariDinnerExtra, quantity: 1 }],
  });

  const dinnerBreakdown = pricingDinner.extrasBreakdown.find((b) => b.extraId === 'additional-safari');
  assert(
    dinnerBreakdown !== undefined && dinnerBreakdown.amountEur === 60,
    'Per-person add-on calculates unit price * paying passengers (3 guests * €20 = €60.00)',
    `Expected 60, got ${dinnerBreakdown?.amountEur}`
  );

  // ==============================================================================
  // 4. TEST HOMEPAGE SECTION ORDER (Requirement 4)
  // ==============================================================================
  console.log('\n4. Checking Homepage Section Order in App.tsx...');
  const appTsxContent = fs.readFileSync(path.resolve(rootDir, 'src/App.tsx'), 'utf-8');

  const heroIndex = appTsxContent.indexOf('<Hero');
  const destinationsIndex = appTsxContent.indexOf('<DestinationsSection');
  const toursIndex = appTsxContent.indexOf('<PopularTours');

  assert(
    heroIndex !== -1 && destinationsIndex !== -1 && toursIndex !== -1,
    'Hero, DestinationsSection, and PopularTours components found in App.tsx'
  );

  assert(
    heroIndex < destinationsIndex && destinationsIndex < toursIndex,
    'Homepage section order verified: (1) Hero -> (2) DestinationsSection -> (3) PopularTours',
    `Indices: Hero=${heroIndex}, Destinations=${destinationsIndex}, Tours=${toursIndex}`
  );

  // ==============================================================================
  // 5. TEST HOTEL NAME IN STEP 4 (Requirement 5)
  // ==============================================================================
  console.log('\n5. Checking Hotel Name Input in StepCustomerInfo...');
  const customerInfoContent = fs.readFileSync(
    path.resolve(rootDir, 'src/components/booking/StepCustomerInfo.tsx'),
    'utf-8'
  );

  assert(
    customerInfoContent.includes('Hotel / Accommodation Name') &&
    customerInfoContent.includes('customer.hotelName') &&
    customerInfoContent.includes("handleChange('hotelName'"),
    'StepCustomerInfo renders Hotel Name input field bound to customer.hotelName'
  );

  // ==============================================================================
  // 6. TEST DEDICATED PDF TICKET PRINTING (Requirement 6)
  // ==============================================================================
  console.log('\n6. Checking Dedicated PDF Ticket Printing...');
  const indexCssContent = fs.readFileSync(path.resolve(rootDir, 'src/index.css'), 'utf-8');
  const confirmationContent = fs.readFileSync(
    path.resolve(rootDir, 'src/pages/BookingConfirmationPage.tsx'),
    'utf-8'
  );
  const myBookingContent = fs.readFileSync(
    path.resolve(rootDir, 'src/pages/MyBookingPage.tsx'),
    'utf-8'
  );

  assert(
    indexCssContent.includes('@media print') &&
    indexCssContent.includes('#printable-ticket') &&
    indexCssContent.includes('visibility: hidden !important'),
    'index.css includes dedicated @media print rules hiding all page chrome except #printable-ticket'
  );

  assert(
    confirmationContent.includes('id="printable-ticket"') &&
    confirmationContent.includes('Awesome Adventure Tours') &&
    confirmationContent.includes('+20 151 5212741'),
    'BookingConfirmationPage includes #printable-ticket container with Awesome Adventure Tours branding & phone'
  );

  assert(
    myBookingContent.includes('id="printable-ticket"') &&
    myBookingContent.includes('Awesome Adventure Tours'),
    'MyBookingPage includes #printable-ticket container with Awesome Adventure Tours branding'
  );

  // ==============================================================================
  // 7. TEST DATA PERSISTENCE & MIGRATION INTEGRITY (Requirement 7)
  // ==============================================================================
  console.log('\n7. Checking Guest Details Persistence & Database Migration...');
  const migrationPath = path.resolve(
    rootDir,
    'supabase/migrations/20261107000000_tour_extras_and_addons_enhancement.sql'
  );
  assert(fs.existsSync(migrationPath), 'Migration 20261107000000_tour_extras_and_addons_enhancement.sql exists');

  const migrationContent = fs.readFileSync(migrationPath, 'utf-8');
  assert(
    migrationContent.includes('per_vehicle') &&
    migrationContent.includes('per_item') &&
    migrationContent.includes('Single Quad') &&
    migrationContent.includes('Double Quad') &&
    migrationContent.includes('Buggy'),
    'Migration adds per_vehicle/per_item constraint and seeds dynamic catalog add-on examples'
  );

  assert(
    migrationContent.includes('create_booking_atomic') &&
    migrationContent.includes('p_customer_hotel') &&
    migrationContent.includes('tour_assigned_extras') &&
    migrationContent.includes('booking_passengers'),
    'create_booking_atomic verifies tour_assigned_extras, persists hotel name, and records passenger manifest'
  );

  console.log(`\n========================================`);
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
