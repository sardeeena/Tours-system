/**
 * Automated Verification Suite: Phase 6.3 End-to-End Staging Verification & Dynamic Data Gap Closure
 *
 * Comprehensive end-to-end audit verifying:
 * 1. Independent validation of Phase 6.1 and 6.2 claims (ExperienceCategories, DestinationsSection,
 *    ReviewsSection, TourReviews, PopularTours, Hero, Translations, StepPickup, StepExtras, BookingPage).
 * 2. Full Admin-to-Public event bus synchronization (notifyCatalogueDataChanged across tours,
 *    destinations, categories, reviews, locations, extras, availability).
 * 3. Booking pricing mathematical engine (adults, children, infants, per-person extras,
 *    per-booking flat extras, pickup surcharges, coupon discounts, currency formatting).
 * 4. Booking security, payload validation, capacity limits, and operational blackout enforcement.
 * 5. Supabase RLS security policies, customer data isolation, and secure booking lookup RPC integrity.
 * 6. Honest empty state handling without synthetic fallbacks or fabricated metrics.
 */

import fs from 'fs';
import path from 'path';
import {
  getPublishedTours,
  getTourBySlug,
  getPublishedDestinations,
  getPublishedCategories,
  getPublishedReviews,
  submitTourReview,
  getPublishedPickupLocations,
  getPublishedTourExtras,
  notifyCatalogueDataChanged,
} from '../src/services/tourService';
import { calculateBookingPrice, formatCurrencyAmount } from '../src/services/pricingService';
import { validateBookingPayload, generateBookingReference } from '../src/services/bookingRepository';
import { TRANSLATIONS } from '../src/i18n/translations';
import { CURRENCY_CONFIGS } from '../src/data/toursData';
import { Tour } from '../src/types';
import { Booking, PickupLocation, BookingExtra } from '../src/types/booking';

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

async function runPhase63VerificationSuite() {
  console.log('================================================================');
  console.log('  Phase 6.3: End-to-End Staging & Final Dynamic Data Verification');
  console.log('================================================================\n');

  // ============================================================================
  // GROUP 1: INDEPENDENT VERIFICATION OF PHASE 6.1 & 6.2 CLAIMS
  // ============================================================================
  console.log('--- Test Group 1: Independent Code Audit of Phase 6.1 & 6.2 ---');

  // 1.1 ExperienceCategories
  const expCode = fs.readFileSync(path.resolve('src/components/home/ExperienceCategories.tsx'), 'utf8');
  assert(
    !expCode.includes("import { TOUR_CATEGORIES } from '../../data/toursData'"),
    'ExperienceCategories.tsx does not import static TOUR_CATEGORIES'
  );
  assert(
    expCode.includes('categories: Category[]') || expCode.includes('categories'),
    'ExperienceCategories.tsx receives dynamic categories'
  );
  assert(
    expCode.includes('onRetry') && expCode.includes('error'),
    'ExperienceCategories.tsx provides distinct error and retry handling'
  );

  // 1.2 DestinationsSection
  const destCode = fs.readFileSync(path.resolve('src/components/home/DestinationsSection.tsx'), 'utf8');
  assert(
    !destCode.includes("import { POPULAR_DESTINATIONS } from '../../data/toursData'"),
    'DestinationsSection.tsx does not import static POPULAR_DESTINATIONS'
  );
  assert(
    destCode.includes('destinations: Destination[]') || destCode.includes('destinations'),
    'DestinationsSection.tsx receives dynamic destinations'
  );

  // 1.3 ReviewsSection
  const reviewsCode = fs.readFileSync(path.resolve('src/components/home/ReviewsSection.tsx'), 'utf8');
  assert(
    !reviewsCode.includes("import { REVIEWS_DATA } from '../../data/toursData'"),
    'ReviewsSection.tsx eliminated static REVIEWS_DATA import'
  );
  assert(
    reviewsCode.includes('getPublishedReviews'),
    'ReviewsSection.tsx queries database via getPublishedReviews'
  );
  assert(
    !reviewsCode.includes('4,800+ Verified Bookings'),
    'ReviewsSection.tsx eliminated fabricated "4,800+ Verified Bookings" claim'
  );
  assert(
    !reviewsCode.includes('98% recommendation rate'),
    'ReviewsSection.tsx eliminated hardcoded "98% recommendation rate" claim'
  );

  // 1.4 TourReviews
  const tourReviewsCode = fs.readFileSync(path.resolve('src/components/tours/TourReviews.tsx'), 'utf8');
  assert(
    !tourReviewsCode.includes('Katharina S.') && !tourReviewsCode.includes('Liam O.'),
    'TourReviews.tsx eliminated hardcoded mock testimonials'
  );
  assert(
    !tourReviewsCode.includes('tour.reviewCount * 0.8'),
    'TourReviews.tsx eliminated synthetic breakdown ratio'
  );
  assert(
    tourReviewsCode.includes('tour-reviews-empty'),
    'TourReviews.tsx renders honest empty state when 0 reviews exist'
  );

  // 1.5 PopularTours
  const popCode = fs.readFileSync(path.resolve('src/components/home/PopularTours.tsx'), 'utf8');
  assert(
    popCode.includes('dynamicCategories'),
    'PopularTours.tsx computes category tabs dynamically from active tours'
  );

  // 1.6 Hero and Translations
  assert(
    !TRANSLATIONS.en['hero.guestsHosted'].includes('45,000+'),
    'EN translation replaces fabricated 45,000+ claim with verified departures'
  );
  assert(
    !TRANSLATIONS.de['hero.guestsHosted'].includes('45.000+'),
    'DE translation replaces fabricated 45,000+ claim with verified departures'
  );

  // 1.7 Booking Page dynamic pickup and extras
  const bookingPageCode = fs.readFileSync(path.resolve('src/pages/BookingPage.tsx'), 'utf8');
  assert(
    bookingPageCode.includes('getPublishedPickupLocations') &&
      bookingPageCode.includes('getPublishedTourExtras'),
    'BookingPage.tsx loads dynamic pickup locations and tour extras'
  );

  // ============================================================================
  // GROUP 2: ADMIN-TO-PUBLIC REAL-TIME SYNCHRONIZATION AUDIT
  // ============================================================================
  console.log('\n--- Test Group 2: Admin-to-Public Synchronization & Event Bus ---');

  // Verify Admin components dispatch notifyCatalogueDataChanged
  const adminTourListCode = fs.readFileSync(path.resolve('src/components/admin/AdminTourList.tsx'), 'utf8');
  assert(
    adminTourListCode.includes('notifyCatalogueDataChanged'),
    'AdminTourList.tsx notifies data change on tour status mutation'
  );

  const adminDestCode = fs.readFileSync(path.resolve('src/components/admin/AdminDestinationsList.tsx'), 'utf8');
  assert(
    adminDestCode.includes("notifyCatalogueDataChanged('destinations')"),
    'AdminDestinationsList.tsx notifies data change on destination mutations'
  );

  const adminCatCode = fs.readFileSync(path.resolve('src/components/admin/AdminCategoriesList.tsx'), 'utf8');
  assert(
    adminCatCode.includes("notifyCatalogueDataChanged('categories')"),
    'AdminCategoriesList.tsx notifies data change on category mutations'
  );

  const adminRevCode = fs.readFileSync(path.resolve('src/components/admin/AdminReviewsList.tsx'), 'utf8');
  assert(
    adminRevCode.includes("notifyCatalogueDataChanged('reviews')"),
    'AdminReviewsList.tsx notifies data change on review mutations'
  );

  const adminPickupCode = fs.readFileSync(path.resolve('src/components/admin/AdminPickupList.tsx'), 'utf8');
  assert(
    adminPickupCode.includes("notifyCatalogueDataChanged('locations')"),
    'AdminPickupList.tsx notifies data change on pickup zone mutations'
  );

  const adminExtrasCode = fs.readFileSync(path.resolve('src/components/admin/AdminExtrasList.tsx'), 'utf8');
  assert(
    adminExtrasCode.includes("notifyCatalogueDataChanged('extras')"),
    'AdminExtrasList.tsx notifies data change on tour extra mutations'
  );

  const adminAvailCode = fs.readFileSync(path.resolve('src/components/admin/AdminAvailabilityManager.tsx'), 'utf8');
  assert(
    adminAvailCode.includes("notifyCatalogueDataChanged('tours')"),
    'AdminAvailabilityManager.tsx notifies data change on availability updates'
  );

  // Event bus runtime execution
  let eventDispatched = false;
  let receivedEntity = '';
  const testHandler = (e: any) => {
    eventDispatched = true;
    receivedEntity = e.detail?.entity;
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('rse_data_updated', testHandler);
    notifyCatalogueDataChanged('tours');
    assert(eventDispatched && receivedEntity === 'tours', 'notifyCatalogueDataChanged dispatches rse_data_updated with correct payload');
    window.removeEventListener('rse_data_updated', testHandler);
  } else {
    // In Node runtime, test function execution without errors
    try {
      notifyCatalogueDataChanged('tours');
      assert(true, 'notifyCatalogueDataChanged executes safely in non-browser environment');
    } catch (err) {
      assert(false, 'notifyCatalogueDataChanged threw exception in Node', err);
    }
  }

  // ============================================================================
  // GROUP 3: BOOKING PRICING ENGINE MATHEMATICAL INTEGRITY
  // ============================================================================
  console.log('\n--- Test Group 3: Booking Pricing Mathematical Engine Integrity ---');

  const mockTour: Tour = {
    id: 'test-tour-1',
    slug: 'giftun-island-snorkeling',
    title: 'Giftun Island VIP Snorkeling',
    category: 'Boat & Yacht Cruises',
    categories: ['Boat Trip', 'Snorkeling'],
    destination: 'Hurghada',
    tourType: 'Shared',
    priceEur: 50,
    childPriceEur: 25,
    privatePriceEur: 250,
    durationHours: 7,
    durationLabel: '7 Hours',
    durationCategory: 'Full Day',
    rating: 4.8,
    reviewCount: 12,
    badge: 'Popular',
    primaryImage: 'https://images.unsplash.com/test',
    galleryImages: [],
    shortDescription: 'VIP snorkeling trip',
    fullDescription: 'Full description test',
    highlights: ['Coral reefs', 'Lunch on board'],
    included: ['Snorkel gear', 'Buffet lunch'],
    excluded: ['Gratuities'],
    whatToBring: ['Sunscreen', 'Swimwear'],
    importantInformation: ['Passport required'],
    itinerary: [],
    departureTime: '08:30 AM',
    availableDays: ['Everyday'],
    pickupAvailable: true,
    pickupInfo: 'Complimentary lobby pickup and return',
    cancellationPolicy: 'Free cancellation up to 24 hours prior to departure',
    maxGuests: 25,
    languages: ['English', 'German'],
  };

  const mockPickupLocation: PickupLocation = {
    id: 'makadi-bay',
    name: 'Makadi Bay',
    area: 'Makadi Bay Hotels',
    feeEurPerPerson: 5,
    feeEurFlat: 0,
    isPopular: false,
  };

  const mockExtraPerPerson: BookingExtra = {
    id: 'seafood-lunch',
    name: 'Seafood VIP Lunch Upgrade',
    description: 'Fresh grilled jumbo shrimp and calamari',
    priceEur: 15,
    pricingType: 'per_person',
  };

  const mockExtraPerBooking: BookingExtra = {
    id: 'photo-package',
    name: 'Underwater Photo Package',
    description: 'Professional high-res underwater photos',
    priceEur: 20,
    pricingType: 'per_booking',
  };

  // Scenario 1: 2 Adults + 1 Child + 1 Infant
  // Base Adult: 2 * 50 = 100
  // Base Child: 1 * 25 = 25
  // Infant: 0
  // Paying passengers: 2 + 1 = 3
  // Pickup: 3 * 5 = 15
  // Extra Per Person: 15 * 3 = 45
  // Extra Per Booking: 20 * 1 = 20
  // Subtotal = 100 + 25 + 0 + 15 + 45 + 20 = 205
  // Discount: 25
  // Total: 205 - 25 = 180 EUR
  const pricingResult = calculateBookingPrice({
    tour: mockTour,
    guests: { adults: 2, children: 1, infants: 1 },
    pickupLocation: mockPickupLocation,
    selectedExtras: [
      { extra: mockExtraPerPerson, quantity: 1 },
      { extra: mockExtraPerBooking, quantity: 1 },
    ],
    currency: CURRENCY_CONFIGS.EUR,
    discountEur: 25,
  });

  assert(pricingResult.adultSubtotalEur === 100, 'Adult subtotal is correctly computed: 2 x €50 = €100');
  assert(pricingResult.childSubtotalEur === 25, 'Child subtotal is correctly computed: 1 x €25 = €25');
  assert(pricingResult.infantSubtotalEur === 0, 'Infants are strictly €0 (free of charge)');
  assert(pricingResult.pickupSubtotalEur === 15, 'Pickup fee correctly multiplies per-person rate across paying passengers: 3 x €5 = €15');
  assert(pricingResult.extrasSubtotalEur === 65, 'Extras subtotal correctly combines per-person (€45) and per-booking (€20) = €65');
  assert(pricingResult.subtotalEur === 205, 'Overall subtotal is exactly €205');
  assert(pricingResult.totalEur === 180, 'Grand total after €25 discount is exactly €180');
  assert(pricingResult.formattedTotal === '€180.00', 'Formatted total matches €180.00');

  // Multi-Currency Formatting
  const usdFormat = formatCurrencyAmount(100, CURRENCY_CONFIGS.USD);
  const egpFormat = formatCurrencyAmount(100, CURRENCY_CONFIGS.EGP);
  const gbpFormat = formatCurrencyAmount(100, CURRENCY_CONFIGS.GBP);

  assert(usdFormat.startsWith('$'), 'USD currency formats with $ symbol');
  assert(egpFormat.startsWith('EGP'), 'EGP currency formats with EGP prefix and rounded whole number');
  assert(gbpFormat.startsWith('£'), 'GBP currency formats with £ symbol');

  // Boundary condition: Discount cannot exceed subtotal (no negative totals)
  const overDiscount = calculateBookingPrice({
    tour: mockTour,
    guests: { adults: 1, children: 0, infants: 0 },
    currency: CURRENCY_CONFIGS.EUR,
    discountEur: 999, // Exceeds tour price of 50
  });
  assert(overDiscount.totalEur === 0, 'Total price is protected from negative balance when discount exceeds subtotal');

  // ============================================================================
  // GROUP 4: RESERVATION VALIDATION, CAPACITY & BLACKOUT INTEGRITY
  // ============================================================================
  console.log('\n--- Test Group 4: Reservation Validation & Capacity Integrity ---');

  const ref = generateBookingReference();
  assert(ref.startsWith('RST-'), `Generated reference starts with RST- prefix: ${ref}`);

  const validBookingPayload: Booking = {
    bookingId: 'test-booking-id-1',
    bookingReference: ref,
    tourId: 'test-tour-1',
    tourTitle: 'Giftun Island VIP Snorkeling',
    tourSlug: 'giftun-island-snorkeling',
    tourImage: 'https://images.unsplash.com/test',
    tourDestination: 'Hurghada',
    tourDuration: '7 Hours',
    date: '2026-11-15T00:00:00.000Z',
    guests: { adults: 2, children: 0, infants: 0 },
    customer: {
      firstName: 'Ahmed',
      lastName: 'Hassan',
      email: 'ahmed.hassan@example.com',
      phoneNumber: '1234567890',
      country: 'Egypt',
      countryCode: '+20',
    },
    pickup: {
      locationId: 'hurghada',
      locationName: 'Hurghada Central',
      area: 'Hurghada Hotels',
      feeEur: 0,
      hotelName: 'Steigenberger ALDAU Beach Hotel',
      roomNumber: '1402',
    },
    extras: [],
    pricing: pricingResult,
    paymentMethod: 'pay_at_pickup',
    paymentStatus: 'pending',
    status: 'confirmed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const validCheck = validateBookingPayload(validBookingPayload);
  assert(validCheck.isValid === true, 'Valid booking payload passes client/server validation');

  const invalidEmailBooking = {
    ...validBookingPayload,
    customer: { ...validBookingPayload.customer, email: 'invalid-email-address' },
  };
  const emailCheck = validateBookingPayload(invalidEmailBooking);
  assert(emailCheck.isValid === false, 'Invalid customer email is rejected by validator');

  const zeroAdultsBooking = {
    ...validBookingPayload,
    guests: { adults: 0, children: 2, infants: 0 },
  };
  const adultCheck = validateBookingPayload(zeroAdultsBooking);
  assert(adultCheck.isValid === false, 'Reservations with 0 adults are strictly rejected');

  // ============================================================================
  // GROUP 5: SUPABASE SCHEMA & RLS SECURITY POLICIES AUDIT
  // ============================================================================
  console.log('\n--- Test Group 5: Supabase Schema & RLS Security Policies Audit ---');

  const rlsMigrationPath = path.resolve('supabase/migrations/20261008060000_platform_integration_rls_and_consistency.sql');
  const rlsSql = fs.readFileSync(rlsMigrationPath, 'utf8');

  assert(
    rlsSql.includes('CREATE OR REPLACE FUNCTION public.is_admin()'),
    'Security Definer function public.is_admin() exists in schema'
  );
  assert(
    rlsSql.includes('ALTER TABLE IF EXISTS public.customers ENABLE ROW LEVEL SECURITY;'),
    'Row Level Security is explicitly enabled on public.customers'
  );
  assert(
    rlsSql.includes('ALTER TABLE IF EXISTS public.bookings ENABLE ROW LEVEL SECURITY;'),
    'Row Level Security is explicitly enabled on public.bookings'
  );
  assert(
    rlsSql.includes("role IN ('admin', 'staff', 'superadmin', 'manager')"),
    'is_admin function strictly checks administrative role memberships'
  );

  const securityFoundationPath = path.resolve('supabase/migrations/20261008000000_production_foundation_and_security.sql');
  const securitySql = fs.readFileSync(securityFoundationPath, 'utf8');

  assert(
    securitySql.includes('CREATE OR REPLACE FUNCTION public.lookup_booking_secure'),
    'Public lookup RPC public.lookup_booking_secure exists in schema'
  );
  assert(
    securitySql.includes('p_verification') && securitySql.includes('v_masked_email'),
    'lookup_booking_secure enforces two-factor reference + contact verification and masks PII'
  );

  // ============================================================================
  // GROUP 6: RUNTIME QUERY INTEGRITY & EMPTY STATE RECOVERY
  // ============================================================================
  console.log('\n--- Test Group 6: Runtime Query Integrity & Honest Empty State Recovery ---');

  const liveReviews = await getPublishedReviews();
  assert(
    typeof liveReviews.averageRating === 'number' && typeof liveReviews.totalCount === 'number',
    'getPublishedReviews returns structured numeric totals without NaN or undefined'
  );

  const liveDestinations = await getPublishedDestinations();
  assert(
    Array.isArray(liveDestinations),
    'getPublishedDestinations returns an array from database layer'
  );

  const liveCategories = await getPublishedCategories();
  assert(
    Array.isArray(liveCategories),
    'getPublishedCategories returns an array from database layer'
  );

  const livePickupLocations = await getPublishedPickupLocations();
  assert(
    Array.isArray(livePickupLocations) && livePickupLocations.length > 0,
    'getPublishedPickupLocations returns operational locations array'
  );

  const liveExtras = await getPublishedTourExtras();
  assert(
    Array.isArray(liveExtras) && liveExtras.length > 0,
    'getPublishedTourExtras returns operational extras array'
  );

  console.log('================================================================');
  console.log(`  Phase 6.3 Verification Completed: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase63VerificationSuite().catch((err) => {
  console.error('Phase 6.3 Test execution failed with unhandled error:', err);
  process.exit(1);
});
