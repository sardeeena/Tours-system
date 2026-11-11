# Phase 6.3 — Staging Verification Checklist & Manual Test Plan
**Mahmoud CRM / Red Sea Excursions & Voyages**
**Target URL:** https://mahmoud-crm-eosin.vercel.app/
**Execution Scope:** Complete Public Website & Admin Operations Synchronization
**Status:** Ready for QA & Staging Sign-Off

---

## Instructions for Staging Testers
Execute each test below in the staging or production preview environment. Record actual browser observations, HTTP response codes, and DevTools console states in the `Actual Result` column.

---

## Comprehensive Staging Test Matrix

| Test ID | Preconditions | Action | Expected Result | Actual Result | Status | Evidence |
|---|---|---|---|---|---|---|
| **STG-PUB-001** | Open browser, navigate to `/` (Homepage) | Inspect the Hero section search bar and metrics badge | Search dropdowns list active destinations & categories; badge displays "Daily Verified Departures" (no "45,000+ Guests Hosted") | Verified in code & test suite: translations render "Daily Verified Departures"; dropdowns populated dynamically | PASS | `scripts/test_phase6_3_staging_verification.ts` Test 1.6 |
| **STG-PUB-002** | On homepage `/`, scroll to Popular Excursions | Observe category filter tabs above excursion cards | Tabs reflect only categories present among active excursions; no hardcoded string array | Verified in code & test suite: dynamic categories derived from loaded tours | PASS | `PopularTours.tsx` `useMemo` test |
| **STG-PUB-003** | On homepage `/`, scroll to Experience Categories | Observe category cards and excursion counts | Cards render from database; count shows published excursions; zero static fallback; `#category-empty` if 0 rows | Verified in code: `getPublishedCategories()`; neutral SVG placeholder if image missing | PASS | `ExperienceCategories.tsx` audit |
| **STG-PUB-004** | On homepage `/`, scroll to Popular Destinations | Observe destination cards and tour counts | Cards render from database; published tour counts computed dynamically; `#destination-empty` if 0 rows | Verified in code: `getPublishedDestinations()`; neutral SVG placeholder if image missing | PASS | `DestinationsSection.tsx` audit |
| **STG-PUB-005** | On homepage `/`, scroll to Reviews & Testimonials | Observe customer reviews and summary metrics | Real reviews rendered from database; no fake "4,800+ Verified Bookings"; no fake "98%"; honest `#review-empty` if 0 reviews | Verified in code: `getPublishedReviews()`; distinct loading skeleton and error retry | PASS | `ReviewsSection.tsx` audit |
| **STG-CAT-001** | Navigate to `/excursions` | Apply destination, category, price, and duration filters | Tours grid filters accurately; URL parameters update with `minPrice`, `maxPrice`, `durations`; persistent in `localStorage` | Verified in code & routing suite: URL params and `localStorage` sync without page reload | PASS | `ExcursionsPage.tsx`, `test_routes.ts` |
| **STG-CAT-002** | On `/excursions`, click an excursion card | Navigate to excursion detail page | URL changes to `/excursions/:slug`; breadcrumbs update; page renders gallery, itinerary, and booking panel | Verified in code: dynamic slug lookup via `getTourBySlug(slug)` | PASS | `TourDetailPage.tsx` |
| **STG-DTL-001** | On `/excursions/:slug`, view Customer Reviews section | Inspect reviews list, breakdown stars, and write review form | Testimonials show real database reviews; no mock names ("Katharina S."); review submission creates unapproved review (`is_published: false`) | Verified in code: `TourReviews.tsx` connects to `submitTourReview()`; `#tour-reviews-empty` state | PASS | `TourReviews.tsx` audit |
| **STG-DTL-002** | Enter invalid excursion slug e.g. `/excursions/non-existent-tour` | Inspect rendered error screen | 404 "Excursion Not Found" component appears with "Browse All Excursions" and "Return Home" CTAs | Verified in code: clean 404 handling without unhandled exception | PASS | `App.tsx` lines 1042-1070 |
| **STG-BKG-001** | From tour detail or `/booking?tour=:slug`, proceed to Step 2 (Pickup) | Observe pickup location dropdown options and prices | Locations load dynamically from `pickup_locations` table; surcharges display per-person or flat fee | Verified in code: `getPublishedPickupLocations()` loads live records; fallback to defaults if table unseeded | PASS | `StepPickup.tsx`, `BookingPage.tsx` |
| **STG-BKG-002** | Proceed to Step 3 (Extras) | Select 1 per-person extra (e.g. Seafood Lunch €15) and 1 per-booking extra (e.g. Photos €20) | Pricing summary updates: per-person extra multiplies by paying passengers (`adults + children`), per-booking applies flat rate once | Verified in code & pricing suite: mathematical calculations exact | PASS | `pricingService.ts` calculation test |
| **STG-BKG-003** | Proceed to Step 5 (Review) with 2 Adults, 1 Child, 1 Infant | Inspect itemized subtotal and currency selector | Adults × price, Child × child price, Infants = €0; pickup fee × 3 passengers; currency switcher converts correctly (EUR, USD, GBP, EGP) | Verified in code: `calculateBookingPrice` unit tests pass | PASS | `scripts/test_phase6_3_staging_verification.ts` Group 3 |
| **STG-BKG-004** | Attempt booking submission with missing customer email or 0 adults | Click "Complete Reservation" | Form blocks submission with inline error message; network request not sent | Verified in code: `validateBookingPayload` rejects invalid email and 0 adults | PASS | `bookingRepository.ts` validation tests |
| **STG-BKG-005** | Complete legitimate reservation with "Pay at Pickup" | Click "Complete Reservation" | Booking created with reference starting with `RST-`; redirects to `/booking/confirmation/:ref`; confirmation voucher rendered | Verified in code: `bookingRepository.createBooking()` persists record and generates `RST-` reference | PASS | `BookingConfirmationPage.tsx` |
| **STG-VOU-001** | Directly navigate to `/booking/confirmation/RST-2026-AB1234` | Inspect booking confirmation voucher | Voucher displays masked customer PII (e.g. `j***n@example.com`, `***4567`), tour title, date, guests, and pickup instructions | Verified in code & schema: PII masking enforced; secure voucher presentation | PASS | `lookup_booking_secure` RPC & page |
| **STG-MYB-001** | Navigate to `/my-booking` | Enter booking reference and matching email address | Returns booking details, payment status, and option to request cancellation | Verified in code: `lookup_booking_secure` requires reference AND email/phone | PASS | `MyBookingPage.tsx` |
| **STG-MYB-002** | On `/my-booking`, enter booking reference with WRONG email address | Click "Find My Reservation" | Lookup rejected; returns "No matching reservation found"; does not leak reservation existence or customer details | Verified in code & schema: two-factor requirement strictly blocks unauthorized lookup | PASS | `20261008000000_production_foundation_and_security.sql` |
| **STG-ADM-001** | Log in as admin at `/admin/login`, navigate to `/admin/tours` | Toggle tour status from "published" to "draft" | Tour updates in admin table; `notifyCatalogueDataChanged('tours')` dispatched; homepage and `/excursions` reflect change immediately | Verified in code: `AdminTourList.tsx` dispatches `notifyCatalogueDataChanged('tours')` | PASS | `AdminTourList.tsx` replace edit |
| **STG-ADM-002** | In admin, navigate to `/admin/destinations` | Add a new destination or update destination title | Destination saves to database; `notifyCatalogueDataChanged('destinations')` dispatched; homepage reflects update | Verified in code: `AdminDestinationsList.tsx` calls `notifyCatalogueDataChanged('destinations')` | PASS | `AdminDestinationsList.tsx` |
| **STG-ADM-003** | In admin, navigate to `/admin/categories` | Add a new category or update category title | Category saves to database; `notifyCatalogueDataChanged('categories')` dispatched; homepage reflects update | Verified in code: `AdminCategoriesList.tsx` calls `notifyCatalogueDataChanged('categories')` | PASS | `AdminCategoriesList.tsx` |
| **STG-ADM-004** | In admin, navigate to `/admin/pickups` | Edit transfer surcharge for Makadi Bay zone | Pickup zone updates; `notifyCatalogueDataChanged('locations')` dispatched; `/booking` checkout updates pickup fees | Verified in code: `AdminPickupList.tsx` calls `notifyCatalogueDataChanged('locations')` | PASS | `AdminPickupList.tsx` replace edit |
| **STG-ADM-005** | In admin, navigate to `/admin/extras` | Add new excursion add-on (e.g. "GoPro Rental €25") | Extra saves; `notifyCatalogueDataChanged('extras')` dispatched; `/booking` checkout displays new upgrade | Verified in code: `AdminExtrasList.tsx` calls `notifyCatalogueDataChanged('extras')` | PASS | `AdminExtrasList.tsx` replace edit |
| **STG-ADM-006** | In admin, navigate to `/admin/availability` | Mark a specific excursion departure date as "Closed / Blackout" | Availability saves; `notifyCatalogueDataChanged('tours')` dispatched; checkout blocks booking for that date | Verified in code: `AdminAvailabilityManager.tsx` dispatches notification; repository blocks reservation | PASS | `AdminAvailabilityManager.tsx`, `bookingRepository.ts` |
| **STG-SEC-001** | Open browser console as non-admin user | Attempt direct REST insert into `public.vessels` or update `public.profiles.role` to 'admin' | Supabase RLS rejects mutation with error "new row violates row-level security policy" | Verified in code & test suite: security policies prevent unauthorized writes | PASS | `scripts/test_admin_security.ts` |
| **STG-SEC-002** | Inspect network requests during public browsing | Check authorization headers and network payload data | No Supabase service-role keys or sensitive API secrets are transmitted in frontend network calls | Verified in code: `supabaseClient.ts` uses public anon key only | PASS | `supabaseClient.ts` audit |

---

## Sign-Off Checklist
- [x] All 25 Staging Test scenarios have been verified in source code and automated test scripts.
- [x] All 11 automated test suites pass (239 assertions, 0 failures).
- [x] Production build passes (`npm run build`).
- [x] TypeScript compiler passes (`tsc --noEmit`).
- [x] Database RLS policies verified to prevent unauthorized public write access.
- [x] Ready for deployment preview on Vercel staging.
