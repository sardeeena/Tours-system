/**
 * Automated Verification: Full Public Website Dynamic Data Audit & Remediation (Phase 6.2)
 *
 * Verifies:
 * 1. Reviews and Testimonials are dynamic database-backed (getPublishedReviews).
 * 2. Static business array imports (REVIEWS_DATA, RECENT_REVIEWS) eliminated from public components and services.
 * 3. Fabricated business metrics removed (no fake 4,800+ bookings, no fake 98% satisfaction, no fake 45,000+ guests).
 * 4. TourReviews.tsx eliminated hardcoded mock testimonials (Katharina S., Liam O., Camille L.) and fake breakdown math.
 * 5. Honest neutral empty states exist across public reviews and tour review components.
 * 6. PopularTours category tabs are dynamically computed from genuine tours rather than hardcoded string arrays.
 * 7. Pickup locations and tour extras in checkout are dynamic database-driven entities.
 * 8. Admin review mutations trigger notifyCatalogueDataChanged('reviews') to keep public pages fresh.
 */

import fs from 'fs';
import path from 'path';
import {
  getPublishedReviews,
  submitTourReview,
  getPublishedPickupLocations,
  getPublishedTourExtras,
  notifyCatalogueDataChanged,
  getTourBySlug,
} from '../src/services/tourService';
import { TRANSLATIONS } from '../src/i18n/translations';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string, detail?: any) {
  if (condition) {
    console.log(`  ✓ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    if (detail !== undefined) {
      console.error('    Detail:', detail);
    }
    failed++;
  }
}

async function runPhase62TestSuite() {
  console.log('================================================================');
  console.log('  Phase 6.2: Full Public Website Dynamic Data Audit Suite');
  console.log('================================================================\n');

  // ----------------------------------------------------------------------------
  // GROUP 1: SOURCE CODE AUDIT - NO FABRICATED METRICS OR STATIC REVIEWS
  // ----------------------------------------------------------------------------
  console.log('--- Test Group 1: Source Code Audit: Reviews & Testimonials ---');

  const reviewsSectionPath = path.resolve('src/components/home/ReviewsSection.tsx');
  const reviewsCode = fs.readFileSync(reviewsSectionPath, 'utf8');

  assert(
    !reviewsCode.includes("import { REVIEWS_DATA } from '../../data/toursData'"),
    'ReviewsSection.tsx no longer imports static REVIEWS_DATA from toursData'
  );
  assert(
    !reviewsCode.includes('REVIEWS_DATA.map'),
    'ReviewsSection.tsx no longer iterates over static REVIEWS_DATA'
  );
  assert(
    reviewsCode.includes('getPublishedReviews'),
    'ReviewsSection.tsx imports and uses getPublishedReviews service'
  );
  assert(
    !reviewsCode.includes('4,800+ Verified Bookings'),
    'ReviewsSection.tsx eliminated fabricated "4,800+ Verified Bookings" claim'
  );
  assert(
    !reviewsCode.includes('98% recommendation rate'),
    'ReviewsSection.tsx eliminated hardcoded "98% recommendation rate" claim'
  );
  assert(
    reviewsCode.includes('review-loading'),
    'ReviewsSection.tsx implements distinct loading skeleton state'
  );
  assert(
    reviewsCode.includes('review-error') && reviewsCode.includes('Retry'),
    'ReviewsSection.tsx implements distinct error state with retry button'
  );
  assert(
    reviewsCode.includes('review-empty'),
    'ReviewsSection.tsx implements honest neutral empty state when 0 reviews exist'
  );

  const tourReviewsPath = path.resolve('src/components/tours/TourReviews.tsx');
  const tourReviewsCode = fs.readFileSync(tourReviewsPath, 'utf8');

  assert(
    !tourReviewsCode.includes('Katharina S.') &&
      !tourReviewsCode.includes('Liam O.') &&
      !tourReviewsCode.includes('Camille L.'),
    'TourReviews.tsx eliminated hardcoded mock guest testimonials (Katharina, Liam, Camille)'
  );
  assert(
    !tourReviewsCode.includes('tour.reviewCount * 0.8'),
    'TourReviews.tsx eliminated fabricated breakdown formula (reviewCount * 0.8)'
  );
  assert(
    tourReviewsCode.includes('tour-reviews-empty'),
    'TourReviews.tsx implements honest neutral empty state for excursions with 0 reviews'
  );
  assert(
    tourReviewsCode.includes('submitTourReview'),
    'TourReviews.tsx supports real submission via submitTourReview service'
  );

  // ----------------------------------------------------------------------------
  // GROUP 2: SOURCE CODE AUDIT - HOMEPAGE TABS, HERO CLAIMS & CHECKOUT
  // ----------------------------------------------------------------------------
  console.log('\n--- Test Group 2: Source Code Audit: Category Tabs, Hero & Checkout ---');

  const popularToursPath = path.resolve('src/components/home/PopularTours.tsx');
  const popCode = fs.readFileSync(popularToursPath, 'utf8');

  assert(
    !popCode.includes("'Boat & Yacht Cruises',"),
    'PopularTours.tsx eliminated hardcoded category string array'
  );
  assert(
    popCode.includes('dynamicCategories'),
    'PopularTours.tsx dynamically computes tabs from active loaded tour categories'
  );

  // Hero claims in translations
  assert(
    !TRANSLATIONS.en['hero.guestsHosted'].includes('45,000+'),
    'EN translation does not contain fabricated "45,000+ Guests" claim'
  );
  assert(
    !TRANSLATIONS.de['hero.guestsHosted'].includes('45.000+'),
    'DE translation does not contain fabricated "45.000+ Gäste" claim'
  );
  assert(
    !TRANSLATIONS.ru['hero.guestsHosted'].includes('45 000+'),
    'RU translation does not contain fabricated "45 000+ гостей" claim'
  );

  // Booking Checkout dynamic pickup and extras
  const stepPickupPath = path.resolve('src/components/booking/StepPickup.tsx');
  const stepPickupCode = fs.readFileSync(stepPickupPath, 'utf8');
  assert(
    stepPickupCode.includes('locations?: PickupLocation[]'),
    'StepPickup.tsx accepts dynamic locations prop'
  );

  const stepExtrasPath = path.resolve('src/components/booking/StepExtras.tsx');
  const stepExtrasCode = fs.readFileSync(stepExtrasPath, 'utf8');
  assert(
    stepExtrasCode.includes('extras?: BookingExtra[]'),
    'StepExtras.tsx accepts dynamic extras prop'
  );

  const bookingPagePath = path.resolve('src/pages/BookingPage.tsx');
  const bookingPageCode = fs.readFileSync(bookingPagePath, 'utf8');
  assert(
    bookingPageCode.includes('getPublishedPickupLocations') &&
      bookingPageCode.includes('getPublishedTourExtras'),
    'BookingPage.tsx loads dynamic pickup locations and tour extras from tourService'
  );

  // ----------------------------------------------------------------------------
  // GROUP 3: SERVICE LAYER AUDIT - SILENT STATIC FALLBACK REMOVAL
  // ----------------------------------------------------------------------------
  console.log('\n--- Test Group 3: Service Layer Audit: Fallback Removal ---');

  const tourServicePath = path.resolve('src/services/tourService.ts');
  const serviceCode = fs.readFileSync(tourServicePath, 'utf8');

  assert(
    !serviceCode.includes('import { ALL_TOURS, RECENT_REVIEWS }'),
    'tourService.ts no longer imports RECENT_REVIEWS from toursData'
  );
  assert(
    !serviceCode.includes('RECENT_REVIEWS.filter'),
    'getTourBySlug no longer falls back to RECENT_REVIEWS when reviews are empty'
  );
  assert(
    serviceCode.includes('getPublishedReviews'),
    'tourService.ts exports getPublishedReviews function'
  );
  assert(
    serviceCode.includes('submitTourReview'),
    'tourService.ts exports submitTourReview function'
  );
  assert(
    serviceCode.includes('getPublishedPickupLocations'),
    'tourService.ts exports getPublishedPickupLocations function'
  );
  assert(
    serviceCode.includes('getPublishedTourExtras'),
    'tourService.ts exports getPublishedTourExtras function'
  );

  // ----------------------------------------------------------------------------
  // GROUP 4: RUNTIME DATA & CALCULATION INTEGRITY
  // ----------------------------------------------------------------------------
  console.log('\n--- Test Group 4: Runtime Data & Calculation Integrity ---');

  const reviewsResult = await getPublishedReviews();
  assert(
    typeof reviewsResult.averageRating === 'number',
    'getPublishedReviews returns numeric averageRating'
  );
  assert(
    typeof reviewsResult.totalCount === 'number',
    'getPublishedReviews returns numeric totalCount'
  );
  assert(
    typeof reviewsResult.recommendationRate === 'number',
    'getPublishedReviews returns numeric recommendationRate'
  );
  assert(
    Array.isArray(reviewsResult.reviews),
    'getPublishedReviews returns reviews array'
  );

  const pickupLocations = await getPublishedPickupLocations();
  assert(
    Array.isArray(pickupLocations) && pickupLocations.length > 0,
    'getPublishedPickupLocations returns active pickup locations'
  );
  assert(
    pickupLocations[0].id !== undefined && pickupLocations[0].name !== undefined,
    'Pickup locations have valid id and name attributes'
  );

  const tourExtras = await getPublishedTourExtras();
  assert(
    Array.isArray(tourExtras) && tourExtras.length > 0,
    'getPublishedTourExtras returns active tour extras'
  );
  assert(
    typeof tourExtras[0].priceEur === 'number',
    'Tour extras priceEur is numeric'
  );

  // ----------------------------------------------------------------------------
  // GROUP 5: ADMIN REVIEW MUTATION NOTIFICATION
  // ----------------------------------------------------------------------------
  console.log('\n--- Test Group 5: Admin Review Mutation Notification ---');

  const adminReviewsPath = path.resolve('src/components/admin/AdminReviewsList.tsx');
  const adminReviewsCode = fs.readFileSync(adminReviewsPath, 'utf8');

  assert(
    adminReviewsCode.includes("notifyCatalogueDataChanged('reviews')"),
    'AdminReviewsList dispatches notifyCatalogueDataChanged("reviews") on mutation'
  );

  console.log('================================================================');
  console.log(`  Phase 6.2 Tests Completed: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase62TestSuite().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
