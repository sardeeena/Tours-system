# 🌊 Red Sea Excursions & Voyages — Comprehensive Technical Project Audit

> **Audit Date:** October 5, 2026  
> **Platform Version:** 2.4.0  
> **Target Environment:** Node.js, Express, React 19, TypeScript, Vite, Supabase (PostgreSQL 15+)  
> **Auditor Role:** Senior Principal Full-Stack & Systems Infrastructure Engineer  

---

## Executive Summary

This document presents a comprehensive, code-verified technical audit of the **Red Sea Excursions & Voyages** platform. The audit contrasts documentation claims with actual code paths across the React frontend, Express API server, Supabase client layer, and PostgreSQL database schemas.

Every major module has been inspected and classified according to actual operational reality, distinguishing between what has database backing, what has working UI, and what persists to production storage.

---

## 1. Current Architecture Overview

The platform operates as a modern hybrid Single-Page Application (SPA) with a lightweight, server-side Express proxy:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Client Layer (React 19 SPA)                     │
│  - Vite 8.x Bundler                                                    │
│  - Tailwind CSS v4 Styling Engine                                      │
│  - Motion (Framer Motion v12) Declarative Animation                    │
│  - Client-Side State: React Context (Auth, Toast, Wishlist, Compare)   │
│  - Offline & PWA Service Worker (Vite PWA Plugin / Workbox)            │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │                                 │
                   ▼ (Direct REST / WebSockets)      ▼ (Proxy Endpoints)
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│       Supabase Backend-as-a-Service  │  │   Express API Server         │
│  - Supabase Auth (JWT / PKCE)        │  │   (server.ts / Port 3000)    │
│  - PostgreSQL 15+ with RLS           │  │   - Security Headers         │
│  - PostgREST RESTful Data Layer      │  │   - Gemini AI Chatbot Engine │
│  - Supabase Storage (tour-media)     │  │   - Health & Telemetry       │
│  - Realtime Table Subscriptions      │  │   - Availability & Inquiries │
└──────────────────────────────────────┘  └──────────────────────────────┘
```

---

## 2. Frontend Architecture

- **Entry Point:** `src/main.tsx` mounts `<App />` wrapped in modular Context Providers:
  - `ThemeProvider`: Light / Dark mode management with persistent `localStorage` synchronization.
  - `LanguageProvider`: 8-locale internationalization (`en`, `de`, `ru`, `fr`, `ar`, `it`, `pl`, `nl`).
  - `ToastProvider`: Global toast notifications for success, warning, error, and info banners.
  - `AuthProvider`: Supabase user session, idle session timeout (30 mins), and live DB profile syncing.
  - `WishlistProvider`: Client-side saved excursion storage.
  - `ComparisonProvider`: Multi-tour side-by-side spec comparison drawer.
- **Routing:** Centralized strongly typed routing in `src/types/routes.ts` with custom history push-state listener in `src/App.tsx`.
- **Public UI Components:**
  - `Hero.tsx`: Dynamic 5-category rotating carousel with high-contrast marine telemetry.
  - `SearchModule.tsx`: Multi-parameter parametric search engine.
  - `PopularTours.tsx`: Grid with responsive Skeleton Shimmer loaders.
  - `TourBookingPanel.tsx`: Sticky real-time checkout calculator with dynamic pickup surcharges.
  - `BookingPage.tsx`: 3-step checkout workflow with customer contact, pickup, and extras.
- **Admin CMS Components:**
  - `AdminLayout.tsx`: Tabbed back-office layout with role-guarded sidebar.
  - `AdminDashboard.tsx`, `AdminTourList.tsx`, `AdminTourEditor.tsx`, `AdminBookingsList.tsx`, `AdminCustomersList.tsx`, `AdminInquiriesList.tsx`, `AdminReviewsList.tsx`, `AdminAvailabilityManager.tsx`, `AdminMediaLibrary.tsx`, `AdminSeoManager.tsx`, `AdminSettings.tsx`.

---

## 3. Backend / API Architecture

The backend entry point is `server.ts`, running on Node.js with Express:
- **Security Middlewares:** 
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `X-XSS-Protection: 1; mode=block`
  - Body payload size limiter (`1mb`)
- **API Endpoints:**
  1. `POST /api/chat`: Server-side proxy invoking `@google/genai` (Gemini 3.8 Flash) with specialized Captain Farouk persona prompt and catalog tour matching.
  2. `GET /api/health`: Comprehensive system diagnostics, Node memory usage (RSS, heap), uptime counter, and database readiness.
  3. `GET /api/config`: Safe public configuration (supported currencies, hotline, booking deposit rules, cancellation policies).
  4. `GET /api/tours`: Parametric catalog API with destination, category, and text search query params.
  5. `POST /api/availability/check`: Real-time departure slot computation enforcing minimum notice cutoff hours.
  6. `POST /api/bookings/lookup`: Verified reference lookup (`RST-YYYY-XXXX`); **strictly returns 404 Not Found when a booking does not exist—never fabricates mock bookings**.
  7. `POST /api/inquiries`: RFC-compliant email validation, ticket number generation (`INQ-YYYY-XXXX`), and inquiry persistence.
  8. `POST /api/newsletter`: RFC email validation, deduplication check, and promotional voucher issuance (`REDSEA15`).
  9. `ALL /api/*`: Centralized 404 handler returning structured JSON errors.
  10. Centralized Express error handler catching unhandled exceptions and malformed JSON.

---

## 4. Supabase Architecture

- **Schema Definition:** Primary migration in `supabase_complete_schema.sql` (2,320 lines) and `supabase/migrations/`.
- **Database Tables (33 Core Tables):**
  - `profiles`: User account extensions (`role`: `admin`, `manager`, `staff`, `customer`).
  - `destinations`: Geographical hubs (Hurghada, El Gouna, Makadi Bay, Sahl Hasheesh, Safaga, Marsa Alam, Sharm El-Sheikh).
  - `categories`: Excursion categories (Boat Trip, Snorkeling, Diving, Desert Safari, Private Yacht, Water Sports).
  - `tours`: Master tour catalog with pricing, duration, difficulty, and publish status.
  - `tour_categories`: Many-to-many relationship linking tours to multiple categories.
  - `tour_images`, `tour_videos`: Media galleries with storage paths and alt text.
  - `tour_itinerary`: Minute-by-minute schedule steps.
  - `tour_inclusions`, `tour_exclusions`: Granular inclusion lists.
  - `tour_highlights`: Bulleted showcase features.
  - `tour_faqs`: Dedicated excursion questions & answers.
  - `pickup_locations`, `tour_pickup_locations`: Resort areas with transfer surcharges.
  - `tour_extras`, `tour_assigned_extras`: Optional upgrades (GoPro, seafood, private transfers).
  - `tour_availability`: Daily slot caps, remaining capacity, and seasonal blackout dates.
  - `customers`: CRM records with contact details, hotel locations, and lifetime spend.
  - `bookings`: Master reservation records with references, dates, guest counts, and status.
  - `booking_extras`: Selected extras per booking.
  - `booking_passengers`: Coast Guard manifest records (passport numbers, nationalities).
  - `reviews`: Verified traveler ratings and commentary.
  - `seo_metadata`: Per-entity meta titles, descriptions, and OpenGraph images.
  - `site_settings`: Global configuration overrides.
  - `audit_logs`: Entity change logs with old/new JSON payloads.
  - `newsletter_subscriptions`: Promotional subscribers with discount codes.
  - `inquiries`: Concierge requests and custom charter leads.
  - `coupons`: Promo codes with discount types and redemption limits.
  - `vessels`, `tour_vessels`: Marine fleet records (engines, capacity, harbor registration).
  - `guides`: Tour leaders and divemasters.
  - `weather_bulletins`: Marine conditions and Coast Guard harbor clearances.
- **SQL Views:**
  - `view_tours_catalog`: Denormalized tour view for high-performance browsing.
  - `view_bookings_detailed`: Consolidated booking details with customer names and totals.
  - `view_coast_guard_manifest`: Daily harbor departure passenger manifest.
  - `view_dashboard_kpis`: Real-time executive KPI counters.

---

## 5. Authentication Architecture

- **Authoritative Provider:** Supabase Auth (`supabase.auth.signInWithPassword`, `signUp`, `signOut`, `updateUser`).
- **Profile Synchronization:** `public.profiles` table is automatically populated via PostgreSQL triggers on `auth.users` (`trigger_on_auth_user_created`).
- **Live Database Role Validation:** `checkAdminAccess()` in `AuthContext.tsx` bypasses client-side storage and directly queries the `profiles` table in Supabase. A user cannot grant themselves administrative privileges via `localStorage`.
- **Session Security:** 30-minute idle activity timer automatically logs out admin/manager sessions.
- **Demo Credentials:** All hardcoded demo credentials (e.g. `admin@redseavoyages.com` / `admin123`) have been audited and removed from production authentication logic.
- **Email Confirmation:** Enforces Supabase email verification before granting full customer or admin dashboard access.

---

## 6. RLS & Security Architecture

- **PostgreSQL Row-Level Security (RLS):** Enabled on all 33 tables.
- **Access Policies:**
  - **Public / Anon:** `SELECT` allowed only on published tours, active destinations, active categories, pickup locations, extras, and published reviews. Can `INSERT` new bookings and customer records.
  - **Customer (Authenticated):** Can read and update their own profile (`auth.uid() = id`), view bookings linked to their `user_id`, and submit inquiries.
  - **Admin / Staff:** Full CRUD access verified via `public.is_admin()` non-recursive security definer function (`role IN ('admin', 'manager', 'staff')`).
- **Statement-Level Caching:** RLS policies utilize `(SELECT auth.uid())` to prevent per-row function evaluation overhead.
- **Privilege Escalation Defense:** Database trigger `prevent_profile_role_escalation` blocks non-admin users from altering their own `role` column in `public.profiles`.

---

## 7. Comprehensive Feature Matrix

| Feature Module | Actual Status | Code Paths & Verification Notes |
|---|---|---|
| **Public Website** | **Fully implemented** | Hero carousel (`Hero.tsx`), search module, popular tours, categories, why us, destinations, reviews, footer, PWA prompt. |
| **Tours Catalog** | **Fully implemented** | `/excursions` with category, destination, price, and duration filters (`ExcursionsPage.tsx`, `TourGrid.tsx`, `TourFilters.tsx`). |
| **Tour Detail Pages** | **Fully implemented** | `/excursions/:slug` with photo gallery, itinerary, inclusions/exclusions, what to bring, important notes, reviews, booking panel (`TourDetailPage.tsx`). |
| **Booking Engine** | **Fully implemented** | 3-step modal & `/booking` page. Validates payload via `validateBookingPayload()`, saves to `bookings`, `customers`, and `booking_extras` with cache fallback (`bookingRepository.ts`). |
| **Customer Accounts** | **Fully implemented** | `/account` and `/profile`. Profile updating via `updateUserProfile()`, reservation history, voucher modal, and wishlist drawer (`AccountPage.tsx`). |
| **Customers CRM** | **Partially implemented** | `AdminCustomersList.tsx` lists customers with contact info, WhatsApp links, and booking history; advanced CRM tagging and notes are basic. |
| **Admin Dashboard** | **Partially implemented** | `AdminDashboard.tsx` displays KPI cards and recent bookings; live data connects to Supabase or computes from cached bookings. |
| **Tour CMS** | **Fully implemented** | `AdminTourList.tsx` & `AdminTourEditor.tsx` support full CRUD for excursions, pricing, media, itineraries, inclusions, extras, and SEO. |
| **Media Library** | **Partially implemented** | `AdminMediaLibrary.tsx` supports Supabase Storage uploads (`tour-media` bucket) with Unsplash fallback and image selection modal. |
| **SEO & Social Meta** | **Fully implemented** | Dynamic `seoService.ts`, `useSeo.ts`, `AdminSeoManager.tsx`, canonical tags, robots meta, OpenGraph, Schema.org JSON-LD, `sitemap.xml`, `robots.txt`, and `llms.txt`. |
| **Availability Management** | **Partially implemented** | `AdminAvailabilityManager.tsx` and Express `/api/availability/check`. Calendar blackout date management works; recurring seasonal capacity templates need UI expansion. |
| **Pickup Locations** | **Fully implemented** | `AdminPickupList.tsx` manages areas and surcharges; integrated into checkout Step 2. |
| **Tour Extras** | **Fully implemented** | `AdminExtrasList.tsx` manages optional add-ons; integrated into checkout Step 3 and persisted to `booking_extras`. |
| **Coupons** | **Database only** | `public.coupons` table and `DbCoupon` type exist. Checkout has basic voucher code state, but no dedicated Admin Coupons manager tab exists. |
| **Bookings Operations** | **Fully implemented** | `AdminBookingsList.tsx` supports status transitions (`confirmed`, `pending`, `cancelled`, `completed`), date filtering, and customer inspection. |
| **Passengers Manifest** | **Database only** | `public.booking_passengers` table and `view_coast_guard_manifest` view exist, but checkout only captures lead customer details and party headcounts. |
| **Vessels Management** | **Database only** | `public.vessels` table exists in PostgreSQL; no vessel management UI exists in the admin navigation. |
| **Guides Management** | **Database only** | `public.guides` table exists in PostgreSQL; no guide management UI exists in the admin navigation. |
| **Weather Bulletins** | **Partially implemented / Mock fallback** | `public.weather_bulletins` table exists; frontend `WeatherConditionsBar.tsx` displays marine conditions with mock fallback data. |
| **Reviews Moderation** | **Fully implemented** | `AdminReviewsList.tsx` allows approving/rejecting guest reviews; published reviews render dynamically on tour pages and homepage. |
| **Concierge Inquiries** | **Fully implemented** | `AdminInquiriesList.tsx`, `HelpInquiryModal.tsx`, `inquiryService.ts`, and Express `/api/inquiries` with ticket numbers (`INQ-YYYY-XXXX`). |
| **Newsletter** | **Fully implemented** | `AdminNewsletterList.tsx`, `NewsletterSubscribe.tsx`, `newsletterService.ts`, and Express `/api/newsletter` with `REDSEA15` promo code. |
| **Audit Logs** | **Database only** | `public.audit_logs` table exists; `DbDetailedAuditLog` type exists; no admin UI tab currently displays audit records. |
| **Site Settings** | **Partially implemented** | `AdminSettings.tsx` manages Supabase connection credentials, default currencies, and contact parameters in local/database storage. |
| **Authentication** | **Fully implemented** | Supabase Auth with PKCE exchange, password reset, email verification detection, session idle timeout, and fallback mode. |
| **Roles & Permissions** | **Fully implemented** | RBAC (`admin`, `manager`, `staff`, `customer`) verified via live database query (`checkAdminAccess()`) and granular permissions (`hasPermission()`). |
| **Row-Level Security** | **Fully implemented** | Comprehensive PostgreSQL RLS policies in `supabase_complete_schema.sql` and `20260928000000_fix_admin_auth_rls.sql`. |
| **AI Assistant** | **Fully implemented** | `FloatingAIChatbot.tsx` with Express `/api/chat` powered by `@google/genai` (Gemini 3.8 Flash) and tour recommendation cards. |
| **Payments** | **UI only / Partial** | `PaymentMethod = 'pay_at_pickup' | 'pay_online'`. Pay at pickup is fully operational; online gateway integration (Stripe/Paymob) is placeholder. |
| **Invoices** | **Partially implemented** | Digital voucher layout exists in `BookingConfirmationPage.tsx` and `MyBookingPage.tsx`; formal accounting/tax invoices with VAT breakdown are missing. |
| **Reports & Analytics** | **Partially implemented** | Dashboard KPI cards and CSV export via `exportService.ts`; automated financial reporting and booking velocity charts are missing. |
| **Notifications** | **Partially implemented** | `notificationService.ts` handles in-app toast alerts, audio cues, and browser Notification API; automated SMS/WhatsApp gateway is future automation. |

---

## 8. Missing Features (Planned in Schema / Docs, Not in UI)

1. **Vessel Fleet Management:** No UI to assign registered marine vessels, boat licenses, or Coast Guard safety inspection dates.
2. **Tour Guide Management:** No UI to assign divemasters, safari leaders, or multilingual tour guides to specific departures.
3. **Coast Guard Passenger Manifest Form:** Checkout does not collect individual passenger passport numbers or nationalities needed for naval clearance.
4. **Audit Log Viewer:** No back-office screen to inspect administrative changes, logins, or role mutations.
5. **Coupons Admin Module:** No UI to create, edit, or deactivate promo discount codes.
6. **Online Payment Gateway Webhooks:** Real Stripe / Paymob card tokenization and automated webhook listeners are not yet connected.

---

## 9. Partially Implemented Features

1. **Weather Conditions:** Telemetry bar in header displays temperature, swell height, and Coast Guard clearance, but uses static fallback data rather than live marine buoy feeds.
2. **Customer CRM:** Lists customers and past bookings, but lacks internal staff notes, customer tags (VIP, high-risk), or direct WhatsApp dispatch integration.
3. **Invoicing & Accounting:** Generates clean customer vouchers with QR references, but lacks tax invoices, expense tracking, and commission calculations for pier booking desks.

---

## 10. Mock / Fallback Behavior

1. **Database Fallback:** If Supabase credentials (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are not provided, services gracefully fall back to local seed data (`toursData.ts`) and `localStorage` caching so the platform remains interactive for demonstrations.
2. **Booking Lookup:** Verified to return proper `404 Not Found` when a booking reference does not exist. **No fake bookings are ever generated.**
3. **Gemini AI Chatbot:** If `GEMINI_API_KEY` is not present, `/api/chat` returns a 503 response and the client falls back to guided concierge recommendations.

---

## 11. Admin Route Problems & Verification

Every `/admin/*` sub-route in `src/App.tsx` has been audited to verify that it maps to a genuine, dedicated component:
- `/admin` ➔ `AdminDashboard` ✅
- `/admin/tours` ➔ `AdminTourList` ✅
- `/admin/tours/new` ➔ `AdminTourEditor` ✅
- `/admin/tours/:id/edit` ➔ `AdminTourEditor` ✅
- `/admin/bookings` ➔ `AdminBookingsList` ✅
- `/admin/inquiries` ➔ `AdminInquiriesList` ✅
- `/admin/customers` ➔ `AdminCustomersList` ✅
- `/admin/newsletter` ➔ `AdminNewsletterList` ✅
- `/admin/destinations` ➔ `AdminDestinationsList` ✅
- `/admin/categories` ➔ `AdminCategoriesList` ✅
- `/admin/pickup` ➔ `AdminPickupList` ✅
- `/admin/extras` ➔ `AdminExtrasList` ✅
- `/admin/reviews` ➔ `AdminReviewsList` ✅
- `/admin/availability` ➔ `AdminAvailabilityManager` ✅
- `/admin/media` ➔ `AdminMediaLibrary` ✅
- `/admin/seo` ➔ `AdminSeoManager` ✅
- `/admin/settings` ➔ `AdminSettings` ✅

**Audit Finding:** None of the existing admin routes point to incorrect or placeholder components. All 17 views render dedicated management interfaces.

---

## 12. Database / Frontend Discrepancies

1. **Passenger Manifests:** The database has table `booking_passengers` with columns `passport_or_id_number` and `nationality`. The frontend checkout modal only collects the lead traveler's name, email, phone, and total passenger counts.
2. **Vessels & Fleet:** The database has `vessels` and `tour_vessels`. The frontend has no vessel assignment or fleet tracking interface.
3. **Audit Logging:** The database has `audit_logs` and an automated trigger on `bookings`, but the admin panel has no log viewer.

---

## 13. Security Evaluation

1. **Authentication:** Uses Supabase Auth with standard password hashing (bcrypt via GoTrue). Hardcoded demo credentials have been purged.
2. **Authorization:** Admin routes re-verify roles directly against the PostgreSQL `profiles` table on route change (`checkAdminAccess()`). Client-side state tampering cannot bypass route protection.
3. **RLS:** All 33 tables have RLS enabled with granular policies for public, authenticated customer, and administrative roles.
4. **Input Sanitization:** Contact forms, checkout inputs, and inquiries pass through `sanitizeString()` to mitigate XSS attacks.
5. **Rate Limiting:** In-memory rate limiters protect checkout submissions, inquiries, newsletter subscriptions, and password resets against spam.

---

## 14. Recommended Implementation Order

To advance the platform from its current production-ready foundation to full enterprise tour-operator maturity, the following phased implementation sequence is recommended:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 1: Operational Manifests & Fleet (Compliance & Coast Guard)     │
│ 1. Add optional Passenger Manifest step to checkout (passports/IDs)   │
│ 2. Create Admin Vessels module (/admin/vessels) for boat registrations│
│ 3. Create Admin Guides module (/admin/guides) for divemasters & leads │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 2: Operations Back-Office Extensions                             │
│ 1. Build Admin Coupons Manager (/admin/coupons)                       │
│ 2. Build Admin Audit Log Viewer (/admin/audit-logs)                   │
│ 3. Add Live Marine Weather CMS to update weather bulletins            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 3: Financial & Communication Automation                          │
│ 1. Integrate online card payment gateway (Stripe / Paymob webhooks)    │
│ 2. Implement automated PDF tax invoice generator with VAT breakdown    │
│ 3. Connect WhatsApp Business / SMS API for automated trip reminders   │
└────────────────────────────────────────────────────────────────────────┘
```

---

*End of Technical Audit Report.*
