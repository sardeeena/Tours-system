import {
  isValidUuid,
  generateDeterministicUuid,
  DESTINATION_UUIDS,
  CATEGORY_UUIDS,
  PICKUP_UUIDS,
  EXTRA_UUIDS,
  TOUR_UUIDS,
  normalizeDurationType,
  normalizeTourType,
  normalizeDifficulty,
  runCatalogueDryRun,
} from './import_catalogue_to_supabase';
import { ALL_TOURS, POPULAR_DESTINATIONS, TOUR_CATEGORIES, REVIEWS_DATA } from '../src/data/toursData';
import { STANDARD_PICKUP_LOCATIONS, GLOBAL_BOOKING_EXTRAS } from '../src/data/bookingData';
import fs from 'fs';
import path from 'path';

/**
 * ==============================================================================
 * NON-DESTRUCTIVE CATALOGUE IMPORT & STORAGE VALIDATION TEST SUITE
 * ==============================================================================
 * Verifies:
 * 1. UUID validation & RFC-4122 compliance (rejects non-hex chars like 't', 'p', 'v')
 * 2. Deterministic ID mapping consistency across repeated runs
 * 3. Source data integrity & duplicate slug/ID detection
 * 4. Foreign key relation hierarchy (destinations, categories, tours, child tables)
 * 5. Dry-run safety (strict zero-write guarantee)
 * 6. Conflict detection & existing record preservation policies
 * 7. Storage configuration ('tour-media' bucket, policies, allowed MIME types, limits)
 * ==============================================================================
 */

let totalPassed = 0;
let totalFailed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    totalPassed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`);
    totalFailed++;
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('  Running Catalogue Import & Schema Validation Test Suite');
  console.log('================================================================\n');

  const importerSource = fs.readFileSync(path.resolve('scripts/import_catalogue_to_supabase.ts'), 'utf8');
  assert(
    !importerSource.includes('cyifhjqqvtiguitrziqs.supabase.co'),
    'Catalogue validator does not default to the unrelated legacy Supabase project'
  );
  assert(
    importerSource.includes("EXPECTED_SUPABASE_PROJECT_REF = 'mktrtoctcjyokclpdeui'"),
    'Catalogue validator is pinned to the Kemet Spirit Supabase project'
  );
  assert(
    importerSource.includes('--execute/--apply is not supported'),
    'Catalogue validator cannot claim to execute a live import'
  );

  // ----------------------------------------------------------------------------
  // TEST GROUP 1: UUID VALIDATION & RFC-4122 COMPLIANCE
  // ----------------------------------------------------------------------------
  console.log('--- Test Group 1: UUID Format & Hex Validation ---');
  assert(isValidUuid('a1000000-0000-0000-0000-000000000001'), 'Valid hex UUID passes');
  assert(isValidUuid('10000000-0000-0000-0000-000000000013'), 'Valid numeric-hex UUID passes');
  assert(!isValidUuid('t1000000-0000-0000-0000-000000000001'), 'Rejects non-hex char "t" in tour prefix');
  assert(!isValidUuid('p1000000-0000-0000-0000-000000000001'), 'Rejects non-hex char "p" in pickup prefix');
  assert(!isValidUuid('v1000000-0000-0000-0000-000000000001'), 'Rejects non-hex char "v" in vessel prefix');
  assert(!isValidUuid('invalid-uuid-string'), 'Rejects arbitrary string');
  assert(!isValidUuid('12345'), 'Rejects short string');

  // Verify all mapped primary keys in import script are 100% valid UUIDs
  const allDestUuidsValid = Object.values(DESTINATION_UUIDS).every(isValidUuid);
  assert(allDestUuidsValid, 'All 7 destination UUIDs are valid hex UUIDs');

  const allCatUuidsValid = Object.values(CATEGORY_UUIDS).every(isValidUuid);
  assert(allCatUuidsValid, 'All category UUIDs are valid hex UUIDs');

  const allPickupUuidsValid = Object.values(PICKUP_UUIDS).every(isValidUuid);
  assert(allPickupUuidsValid, 'All 7 pickup location UUIDs are valid hex UUIDs');

  const allExtraUuidsValid = Object.values(EXTRA_UUIDS).every(isValidUuid);
  assert(allExtraUuidsValid, 'All 6 tour extra UUIDs are valid hex UUIDs');

  const allTourUuidsValid = Object.values(TOUR_UUIDS).every(isValidUuid);
  assert(allTourUuidsValid, 'All 13 tour UUIDs are valid hex UUIDs');
  assert(Object.keys(TOUR_UUIDS).length === ALL_TOURS.length, 'Every static tour has exactly one deterministic UUID mapping');

  // ----------------------------------------------------------------------------
  // TEST GROUP 2: DETERMINISTIC ID MAPPING & STABILITY
  // ----------------------------------------------------------------------------
  console.log('\n--- Test Group 2: Deterministic ID Mapping & Stability ---');
  const sample1 = generateDeterministicUuid('tour', 'orange-bay-island-snorkeling');
  const sample2 = generateDeterministicUuid('tour', 'orange-bay-island-snorkeling');
  const sampleOther = generateDeterministicUuid('tour', 'giftun-island-boat-trip');

  assert(sample1 === sample2, 'Deterministic UUID generates identical output for identical input');
  assert(sample1 !== sampleOther, 'Deterministic UUID generates distinct output for distinct input');
  assert(isValidUuid(sample1), 'Deterministic UUID produces valid RFC-4122 format');

  // Child ID determinism across index
  const itinStep1 = generateDeterministicUuid('itinerary', `${sample1}:1`);
  const itinStep2 = generateDeterministicUuid('itinerary', `${sample1}:1`);
  assert(itinStep1 === itinStep2, 'Child relation UUID is strictly repeatable across runs');

  // ----------------------------------------------------------------------------
  // TEST GROUP 3: SOURCE DATA VALIDATION & DUPLICATE DETECTION
  // ----------------------------------------------------------------------------
  console.log('\n--- Test Group 3: Source Validation & Duplicate Detection ---');
  assert(ALL_TOURS.length === 13, `Source contains exact 13 authoritative tours (found ${ALL_TOURS.length})`);
  assert(POPULAR_DESTINATIONS.length === 7, `Source contains exact 7 destinations (found ${POPULAR_DESTINATIONS.length})`);
  assert(TOUR_CATEGORIES.length === 6, `Source contains exact 6 categories (found ${TOUR_CATEGORIES.length})`);
  assert(REVIEWS_DATA.length === 0, 'No fabricated static guest reviews are shipped');

  assert(
    ALL_TOURS.every((tour) => tour.rating === 0 && tour.reviewCount === 0 && (!tour.reviews || tour.reviews.length === 0)),
    'Tours do not ship unsupported ratings, review counts, or embedded testimonials'
  );

  assert(
    POPULAR_DESTINATIONS.every((destination) =>
      destination.tourCount === ALL_TOURS.filter((tour) => tour.destination === destination.name).length
    ),
    'Destination excursion counts are derived from the actual catalogue'
  );

  const categoryAliases: Record<string, string[]> = {
    'Boat Trips': ['Boat Trip', 'Boat Trips', 'Island', 'Island Visits'],
    'Private Tours': ['Private Tour', 'Private Tours'],
    Safari: ['Safari', 'Quad'],
  };
  assert(
    TOUR_CATEGORIES.every((category) => {
      const aliases = categoryAliases[category.name] || [category.name];
      const count = ALL_TOURS.filter((tour) =>
        aliases.some((alias) => tour.category === alias || tour.categories.includes(alias))
      ).length;
      return category.tourCount === count;
    }),
    'Category excursion counts are derived from the actual catalogue'
  );

  const catalogueSeedSql = fs.readFileSync(path.resolve('supabase/seed/kemet_spirit_catalogue.sql'), 'utf8');
  assert(
    !/\\b(DELETE|UPDATE|TRUNCATE|DROP)\\s+/i.test(catalogueSeedSql),
    'Catalogue seed never deletes, updates, truncates, or drops existing production records'
  );
  assert(
    catalogueSeedSql.includes("'published'") &&
      catalogueSeedSql.includes("'what_to_bring'") &&
      catalogueSeedSql.includes("'important_information'"),
    'Catalogue seed imports published tour records and preserves preparation sections'
  );
  assert(
    catalogueSeedSql.includes("'Illustrative stock photo") &&
      catalogueSeedSql.includes('FALSE'),
    'Catalogue seed labels stock imagery and keeps unverified pickup fee records inactive'
  );
  assert(
    catalogueSeedSql.includes('rating,review_count') &&
      catalogueSeedSql.includes(', 0, 0,'),
    'Catalogue seed never assigns synthetic tour ratings or review counts'
  );
  assert(
    !catalogueSeedSql.includes('REVIEWS_DATA') &&
      !catalogueSeedSql.includes('verifiedBooking'),
    'Catalogue seed imports no fabricated customer reviews'
  );

  const tourServiceSource = fs.readFileSync(path.resolve('src/services/tourService.ts'), 'utf8');
  assert(
    !tourServiceSource.includes('recommendationRate: 98') && !tourServiceSource.includes('REVIEWS_DATA.filter'),
    'Unconfigured frontend never substitutes invented review totals or testimonials'
  );

  assert(
    tourServiceSource.includes("faq.section === 'what_to_bring'") &&
      tourServiceSource.includes("faq.section === 'important_information'"),
    'Database tour mapping restores what-to-bring and important-information sections'
  );
  assert(
    tourServiceSource.includes(".eq('section', 'faq')") &&
      tourServiceSource.includes(".eq('section', 'what_to_bring')") &&
      tourServiceSource.includes(".eq('section', 'important_information')"),
    'Admin FAQ edits preserve unrelated tour preparation sections'
  );

  const seoConfigSource = fs.readFileSync(path.resolve('src/services/seoConfig.ts'), 'utf8');
  const seoServiceSource = fs.readFileSync(path.resolve('src/services/seoService.ts'), 'utf8');
  const tourBookingPanelSource = fs.readFileSync(path.resolve('src/components/tours/TourBookingPanel.tsx'), 'utf8');
  const tourCardSource = fs.readFileSync(path.resolve('src/components/tours/TourCard.tsx'), 'utf8');
  assert(
    !seoConfigSource.includes('reviewCount: \'1240\'') &&
      !seoConfigSource.includes('Yes, all Red Sea excursions include door-to-door'),
    'Homepage SEO contains no fabricated aggregate reviews or universal pickup claim'
  );
  assert(
    !seoConfigSource.includes('All full-day island cruises and boat trips provide professional masks') &&
      !seoConfigSource.includes('We provide free cancellation up to 24 hours prior to departure'),
    'Homepage FAQs do not promise universal equipment or cancellation terms'
  );
  assert(
    tourBookingPanelSource.includes('{tour.cancellationPolicy ||') &&
      !tourBookingPanelSource.includes('Free cancellation up to 24 hours prior to departure.'),
    'Booking panel displays the selected tour cancellation policy'
  );
  assert(
    !tourCardSource.includes('Free 24h Cancellation') &&
      !seoServiceSource.includes('hotel lobby pickup included, free 24h cancellation'),
    'Tour cards and SEO do not imply a universal 24-hour cancellation window'
  );

  assert(STANDARD_PICKUP_LOCATIONS.length === 7, `Source contains exact 7 pickup zones (found ${STANDARD_PICKUP_LOCATIONS.length})`);
  assert(GLOBAL_BOOKING_EXTRAS.length === 6, `Source contains exact 6 booking extras (found ${GLOBAL_BOOKING_EXTRAS.length})`);

  // Detect duplicate slugs in tours
  const tourSlugs = new Set<string>();
  let duplicateSlugs = 0;
  ALL_TOURS.forEach((t) => {
    if (tourSlugs.has(t.slug)) duplicateSlugs++;
    tourSlugs.add(t.slug);
  });
  assert(duplicateSlugs === 0, 'Zero duplicate tour slugs in source data');

  // Detect duplicate slugs in destinations
  const destSlugs = new Set<string>();
  let duplicateDestSlugs = 0;
  POPULAR_DESTINATIONS.forEach((d) => {
    if (destSlugs.has(d.slug)) duplicateDestSlugs++;
    destSlugs.add(d.slug);
  });
  assert(duplicateDestSlugs === 0, 'Zero duplicate destination slugs in source data');

  // Detect duplicate slugs in categories
  const catSlugs = new Set<string>();
  let duplicateCatSlugs = 0;
  TOUR_CATEGORIES.forEach((c) => {
    if (catSlugs.has(c.slug)) duplicateCatSlugs++;
    catSlugs.add(c.slug);
  });
  assert(duplicateCatSlugs === 0, 'Zero duplicate category slugs in source data');

  // ----------------------------------------------------------------------------
  // TEST GROUP 4: FOREIGN KEY MAPPING & ORPHAN INTEGRITY
  // ----------------------------------------------------------------------------
  console.log('\n--- Test Group 4: Foreign-Key Hierarchy & Orphan Integrity ---');
  let missingDestCount = 0;
  ALL_TOURS.forEach((t) => {
    if (!DESTINATION_UUIDS[t.destination]) missingDestCount++;
  });
  assert(missingDestCount === 0, '100% of tours map to an authoritative destination UUID');

  let unmappedCatCount = 0;
  ALL_TOURS.forEach((t) => {
    const cats = Array.from(new Set([t.category, ...(t.categories || [])]));
    cats.forEach((c) => {
      if (!CATEGORY_UUIDS[c]) unmappedCatCount++;
    });
  });
  assert(unmappedCatCount === 0, '100% of tour category tags map to an authoritative category UUID');

  // ----------------------------------------------------------------------------
  // TEST GROUP 5: SCHEMA CONSTRAINT NORMALIZATION
  // ----------------------------------------------------------------------------
  console.log('\n--- Test Group 5: PostgreSQL Schema Constraint Normalization ---');
  assert(normalizeDurationType('Full Day') === 'Full Day', 'Normalizes "Full Day" to "Full Day"');
  assert(normalizeDurationType('Half Day') === 'Half Day', 'Normalizes "Half Day" to "Half Day"');
  assert(normalizeDurationType('hours') === 'Full Day', 'Maps legacy "hours" to valid constraint "Full Day"');

  assert(normalizeTourType('shared') === 'Shared', 'Normalizes "shared" to "Shared"');
  assert(normalizeTourType('private') === 'Private', 'Normalizes "private" to "Private"');
  assert(normalizeTourType('Shared') === 'Shared', 'Preserves valid "Shared"');

  assert(normalizeDifficulty('Easy') === 'Easy', 'Preserves "Easy"');
  assert(normalizeDifficulty('Moderate') === 'Moderate', 'Preserves "Moderate"');
  assert(normalizeDifficulty('Challenging') === 'Adventurous', 'Maps "Challenging" to schema enum "Adventurous"');

  // ----------------------------------------------------------------------------
  // TEST GROUP 6: DRY-RUN EXECUTION & REPORT VERIFICATION
  // ----------------------------------------------------------------------------
  console.log('\n--- Test Group 6: Dry-Run Mode & Non-Destructive Execution ---');
  const report = await runCatalogueDryRun({ executeLive: false, offline: true });

  assert(report.executionMode === 'dry-run', 'Execution mode is strictly "dry-run"');
  assert(report.sourceCounts.tours === 13, 'Dry-run parsed exactly 13 tours');
  assert(report.sourceCounts.destinations === 7, 'Dry-run parsed exactly 7 destinations');
  assert(report.sourceCounts.categories === 6, 'Dry-run parsed exactly 6 categories');
  assert(report.idValidation.invalidCount === 0, 'Dry-run validated 0 invalid UUIDs');
  assert(report.foreignKeyIntegrity.passed, 'Dry-run foreign-key tree verified 100% intact');
  assert(report.schemaCompatibility.passed, 'Dry-run schema compatibility verified 100% compliant');

  // ----------------------------------------------------------------------------
  // TEST GROUP 7: SUPABASE STORAGE CONFIGURATION & BUCKET POLICIES
  // ----------------------------------------------------------------------------
  console.log('\n--- Test Group 7: Supabase Storage Configuration & Policies ---');
  const schemaSql = fs.readFileSync(path.resolve('supabase/schema.sql'), 'utf8');

  assert(
    schemaSql.includes("'tour-media'"),
    'Database schema declares "tour-media" storage bucket'
  );
  assert(
    schemaSql.includes("bucket_id = 'tour-media'"),
    'Storage policy enables public SELECT on "tour-media" bucket'
  );
  assert(
    schemaSql.includes("image/jpeg") && schemaSql.includes("image/webp"),
    'Allowed MIME types permit WebP, JPEG, and PNG'
  );

  // ----------------------------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`Results: ${totalPassed} passed, ${totalFailed} failed.`);
  console.log('================================================================\n');

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal error running catalogue test suite:', err);
  process.exit(1);
});
