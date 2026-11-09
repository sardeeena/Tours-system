# ⚡ Supabase Architecture & Complete Production Setup Guide

> Comprehensive end-to-end guide for provisioning, configuring, securing, and deploying **Supabase** (PostgreSQL 15+, Supabase Auth, Row-Level Security, Storage Buckets, and Triggers) for **Red Sea Excursions & Voyages**.

---

## 📑 Table of Contents

1. [Quick-Start: Launch in 5 Minutes](#-quick-start-launch-in-5-minutes)
2. [Database Architecture & Entity Diagram](#-database-architecture--entity-diagram)
3. [Step 1: Create Your Supabase Project](#-step-1-create-your-supabase-project)
4. [Step 2: Environment Variables & Connection Setup](#-step-2-environment-variables--connection-setup)
5. [Step 3: Run the Complete Schema Migration](#-step-3-run-the-complete-schema-migration)
6. [Step 4: Seed the Production Excursion Catalog](#-step-4-seed-the-production-excursion-catalog)
7. [Step 5: Configure Supabase Authentication](#-step-5-configure-supabase-authentication)
8. [Step 6: Promote Your Administrator Account](#-step-6-promote-your-administrator-account)
9. [Step 7: Verify Storage Buckets](#-step-7-verify-storage-buckets)
10. [Step 8: Verify Live Database in Admin CMS](#-step-8-verify-live-database-in-admin-cms)
11. [Complete 33-Table Schema Reference](#-complete-33-table-schema-reference)
12. [Row-Level Security (RLS) Security Matrix](#-row-level-security-rls-security-matrix)
13. [Troubleshooting & Diagnostics](#-troubleshooting--diagnostics)

---

## ⚡ Quick-Start: Launch in 5 Minutes

Follow these quick steps to connect your Supabase database to the website:

1. **Create Project**: Go to [supabase.com](https://supabase.com), create a new project (select a region close to your primary visitors, e.g., Frankfurt `eu-central-1` or London `eu-west-2`).
2. **Copy Keys**: In **Project Settings > API**, copy the **Project URL** and **anon public key**.
3. **Set Environment**: Put them in your `.env` file or enter them directly in the website under `/admin` > **Settings**.
4. **Execute Schema**: Copy `/complete_schema.sql` (the canonical, authoritative schema covering all 54 tables, RPCs, and RLS policies) and run it in the Supabase **SQL Editor**.
5. **Execute Seed**: Copy `/supabase/seed.sql` and run it in the **SQL Editor** to populate verified Red Sea excursions, categories, pickup points, and fleet vessels.
6. **Promote Admin**: In the SQL Editor, run:
   ```sql
   SELECT public.set_admin_role_by_email('your-email@domain.com');
   ```
7. **Verify**: Visit `/admin` on your website. The connection status indicator will turn green: **Connected (Live Supabase integration active)**.

---

## 🏗️ Database Architecture & Entity Diagram

The database is built on **PostgreSQL 15** with high normalization, strict relational integrity, single-query relational joins, and 100% Row-Level Security (RLS) coverage across all 33 tables:

```
                  auth.users (Supabase Managed)
                       │
                       ▼ (1:1 via trigger)
                    profiles ◄──────────────────────────────┐
                       │                                    │
                       ▼                                    │
                   customers                                │
                       │                                    │
                       ▼                                    │
                    bookings ───────────────────────────────┘ (user_id)
                       │
                       ├──► booking_extras ◄──► tour_extras
                       ├──► booking_passengers (manifests)
                       │
                       ▼
                     tours ◄──────────────► categories (via tour_categories)
                       │
                       ├──► destinations (destination_id)
                       ├──► tour_images & tour_videos
                       ├──► tour_itinerary (minute-by-minute timeline)
                       ├──► tour_inclusions & tour_exclusions
                       ├──► tour_highlights & tour_faqs
                       ├──► tour_availability (capacity caps & blackout dates)
                       ├──► tour_vessels ◄──► vessels (marine fleet & yachts)
                       ├──► tour_assigned_extras ◄──► tour_extras
                       ├──► tour_pickup_locations ◄──► pickup_locations
                       └──► reviews (verified traveler ratings)

 Auxiliary & Operations Engines:
   ├── inquiries (Concierge & Help Requests)
   ├── newsletter_subscriptions (Marketing & Promos)
   ├── coupons (Promo codes & vouchers)
   ├── guides (Captains, divemasters, guides)
   ├── faqs (Global categorized questions)
   ├── weather_bulletins (Daily sea conditions & Coast Guard status)
   ├── seo_metadata (Rich OpenGraph & structured data)
   ├── site_settings (Company info & operational parameters)
   └── audit_logs (Security & administrative event history)
```

---

## 🔑 Step 1: Create Your Supabase Project

1. Log in to [Supabase](https://app.supabase.com).
2. Click **New Project** and choose your organization.
3. Configure the project:
   - **Name**: `Red Sea Excursions` (or your company name).
   - **Database Password**: Generate and store a strong password.
   - **Region**: Choose a region close to your target audience (e.g. Frankfurt, London, or Bahrain).
   - **Pricing Plan**: Free tier or Pro tier.
4. Click **Create new project** and wait ~60 seconds for provisioning.

---

## 🌐 Step 2: Environment Variables & Connection Setup

### Option A: Via `.env` (Recommended for Local Dev & Production Builds)
Create a `.env` file in the root of the project with:

```bash
# Supabase API Credentials (Project Settings > API)
VITE_SUPABASE_URL="https://<your-project-id>.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Option B: In-Browser Credential Manager (Instant, Zero Container Restart)
The application includes an in-browser key manager located in the Admin CMS:
1. Navigate to `/admin` in your browser.
2. In the sidebar, select **Settings**.
3. Under **PostgreSQL & Storage Backend**, enter your **Supabase URL** and **Anon Key**.
4. Click **Test Connection & Save Credentials**.
5. The system tests live query capability with `public.destinations` and activates the live database instantly.

> **Security Note**: Only the public `anon` key should ever be used on the client. Never provide the `service_role` secret to the frontend.

---

## 📜 Step 3: Run the Complete Schema Migration

The authoritative canonical schema file is located at:
```
/complete_schema.sql
```

1. Open your **Supabase Dashboard** > click **SQL Editor** in the left sidebar.
2. Click **New Query**.
3. Copy the entire contents of `/complete_schema.sql` and paste it into the editor.
4. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`).
5. **Expected Output**: `Success. No rows returned.`

### What this migration creates:
- **Extensions**: `uuid-ossp` and `pgcrypto`.
- **54 Relational Tables**: Full schema covering Public Catalog, CMS, Bookings, Manifests, Operations, Fleet, Guides, Finance, CRM, Communications, and Media Assets.
- **100+ Performance Indexes**: Indexed on foreign keys, slugs, emails, composite analytics filters, and RLS columns.
- **Triggers**:
  - `handle_updated_at`: Automatically stamps `updated_at` on updates across all mutating tables.
  - `on_auth_user_created`: Automatically creates a `public.profiles` row when a user signs up.
  - `on_auth_user_confirmed`: Synchronizes email verification state.
  - `protect_profile_role`: Prevents non-admin users from escalating their own privileges.
- **RPC Functions**:
  - `lookup_booking_secure`: High-security traveler booking voucher verification.
  - `request_booking_cancellation_secure`: Secure cancellation workflow with 24-hour refund window check.
  - `create_booking_atomic`: Concurrency-locked (`FOR UPDATE`) atomic checkout and capacity decrement.
  - `get_tour_availability_schedule`: Authoritative calendar departure availability.
  - `recalculate_customer_stats`: Automatic CRM lifetime customer metric rollup.
  - `get_executive_bi_metrics` & `query_custom_bi_report`: Server-side BI aggregation engines.
- **Storage Buckets & Policies**: `tour-media`, `avatars`, and private `vouchers`.
- **Row Level Security**: 112 strict, non-recursive RLS policies enforcing tenant isolation.
- **Security Functions**:
  - `public.is_admin()`: High-performance, non-recursive, security definer role checker.
  - `public.set_admin_role_by_email(email)`: One-command helper to promote admin accounts safely.
- **Row-Level Security (RLS)**: 100% coverage with optimized `(SELECT auth.uid())` statements.
- **Storage Buckets**: Pre-configures `tour-media`, `avatars`, and `vouchers` buckets with upload policies.
- **API Grants**: Explicit grants to `anon` and `authenticated` roles on schema `public`.

---

## 🐬 Step 4: Seed the Production Excursion Catalog

The seed file is located at:
```
/supabase/seed.sql
```

1. In the **Supabase Dashboard** > **SQL Editor**, click **New Query**.
2. Copy and paste the entire contents of `supabase/seed.sql`.
3. Click **Run**.
4. **Expected Output**: `Success. No rows returned.`

### What this seeds:
- **5 Coastal Destinations**: Hurghada, El Gouna, Makadi Bay, Sahl Hasheesh, Safaga & Soma Bay.
- **8 Excursion Categories**: Boat Trips, Snorkeling, Scuba Diving, Desert Safaris, Private Yacht Charters, Submarine & Glass Bottom, Water Sports, Cultural Tours.
- **5 Pickup Hubs**: Hurghada Central Marina, El Gouna Luxury Resorts, Makadi Bay Hotel Zone, Sahl Hasheesh Promenade, Soma Bay & Safaga Port.
- **6 Popular Tour Extras**: Underwater GoPro Camera, Seafood Platter Upgrade, Private Transfer Van, Banana Boat Ride, Photo Package, Extra Scuba Tank.
- **5 Detailed Excursions**: Complete with minute-by-minute itineraries, inclusions, exclusions, what to bring, and rich image galleries.
- **Active Promotional Coupons**: `WELCOME10` (10% off), `SUMMER15` (15% off), `FAMILY20` (€20 off).
- **Maritime Fleet Vessels**: Motor yachts, catamarans, and speedboats with capacities and inspection credentials.
- **Captains & Crew Profiles**: Licensed local captains, PADI divemasters, and multilingual snorkel guides.
- **Global FAQs & Weather Bulletin**: Essential traveler questions and live marine conditions.
- **Zero Demo Bookings**: Kept pristine for real traveler reservations.

---

## 🔐 Step 5: Configure Supabase Authentication

1. Open your **Supabase Dashboard** > **Authentication** > **Providers** > **Email**:
   - Ensure **Email provider** is **Enabled**.
   - **Confirm email**: Recommended **ON** for production (or OFF for rapid development).
   - **Secure email change**: Enabled.
2. In **Authentication** > **URL Configuration**:
   - **Site URL**: Your production domain (e.g. `https://redseaexcursions.com` or your preview URL).
   - **Redirect URLs**: Add the following callback URLs:
     ```
     https://your-domain.com/**
     https://your-domain.com/login
     http://localhost:3000/**
     http://localhost:3000/login
     ```
3. Email Templates (Optional):
   - You can customize the confirmation email under **Authentication > Email Templates** to feature your logo and brand colors (`#0A6C74`).

---

## 👑 Step 6: Promote Your Administrator Account

To access the CMS at `/admin`, an account must have the `admin` role in `public.profiles`.

1. Go to your website at `/register` or `/login` and create an account using your email (e.g. `diamond.entertainment70@gmail.com`).
2. Go to **Supabase Dashboard** > **SQL Editor**.
3. Run the helper function:
   ```sql
   SELECT public.set_admin_role_by_email('diamond.entertainment70@gmail.com');
   ```
4. **Expected Output**:
   ```
   Success: Account diamond.entertainment70@gmail.com (User ID: ...) is now an active administrator.
   ```
5. You can now log in at `/admin/login` or click **Admin CMS** in the website footer.

---

## 📦 Step 7: Verify Storage Buckets

The migration automatically creates all three required buckets:

| Bucket Name | Access Level | Allowed MIME Types | Max Size | Description |
|---|---|---|---|---|
| `tour-media` | Public | Images (`jpeg`, `png`, `webp`, `avif`) & Videos (`mp4`, `webm`) | 25 MB | Tour galleries, hero banners, and promotional media |
| `avatars` | Public | Images (`jpeg`, `png`, `webp`, `avif`) | 5 MB | User profile avatars |
| `vouchers` | Private (RLS) | Documents (`application/pdf`) | 10 MB | Official booking tickets and transfer vouchers |

To verify:
1. Open **Supabase Dashboard** > **Storage**.
2. Confirm `tour-media`, `avatars`, and `vouchers` are listed.
3. If not present, click **New Bucket**, enter the name, and toggle **Public bucket** as specified in the table above.

---

## 🎯 Step 8: Verify Live Database in Admin CMS

1. In your browser, navigate to `/admin`.
2. Sign in with your administrator credentials.
3. Navigate to **Settings** in the CMS sidebar.
4. Click **Test Connection**.
5. You will see a live confirmation:
   ```
   Connection successful! Connected to remote PostgreSQL database. Verified query response: 5 destination(s) retrieved.
   ```
6. Visit the **Excursions**, **Bookings**, **Help Inquiries**, **Customers**, and **Newsletter** tabs to manage live data.

---

## 📋 Complete 33-Table Schema Reference

### 1. User Accounts & Identity
- `profiles`: Extends Supabase `auth.users` with `full_name`, `avatar_url`, `phone`, `country`, `is_confirmed`, and `role` (`admin`, `manager`, `staff`, `customer`).

### 2. Catalog & Discovery
- `destinations`: Coastal hubs (Hurghada, El Gouna, Makadi Bay, Safaga, Sahl Hasheesh) with descriptions and airport distances.
- `categories`: Excursion categories (Boat Trips, Snorkeling, Diving, Safari) with icons and display ordering.
- `tours`: Primary excursions catalog with pricing tiers (`price`, `child_price`, `infant_price`, `private_price`), duration, difficulty, pickup policies, and status (`draft`, `published`, `archived`).
- `tour_categories`: Many-to-many relationship linking tours to multiple categories.
- `tour_images`: Gallery images with sort order and primary cover flag.
- `tour_videos`: Video links (YouTube, Vimeo, Supabase Storage).
- `tour_itinerary`: Ordered timeline stops (e.g. 08:30 Hotel Pickup, 09:30 Harbor Departure, 11:00 Coral Reef Snorkel).
- `tour_inclusions`: Included amenities (lunch buffet, snorkeling gear, marina taxes).
- `tour_exclusions`: Excluded costs (national park entry fee, professional video).
- `tour_highlights`: Bulleted highlights for cards and overview sections.
- `tour_faqs`: Excursion-specific frequently asked questions.
- `tour_availability`: Daily calendar capacities and blackout dates.

### 3. Pricing, Upgrades & Transfers
- `pickup_locations`: Transfer zones with area pickup notes and optional transfer surcharges.
- `tour_pickup_locations`: Junction linking tours with valid pickup areas.
- `tour_extras`: Add-ons (GoPro rental, seafood platter, private transfer).
- `tour_assigned_extras`: Junction linking tours with available optional extras.
- `coupons`: Promotional discount codes with percentage or fixed reductions, expiration, and minimum spend rules.

### 4. Fleet & Marine Operations
- `vessels`: Fleet vessels (yachts, catamarans, speedboats) with passenger capacities and safety inspection dates.
- `tour_vessels`: Links tours with assigned vessels.
- `guides`: Captains, PADI divemasters, and snorkel guides with language capabilities and ratings.
- `weather_bulletins`: Daily maritime reports with sea temperatures, swell heights, wind speeds, and Egyptian Coast Guard clearance status.

### 5. Reservations & Bookings
- `customers`: Customer registry linking contact info, nationality, hotel name, and room number to optional `auth.users` IDs.
- `bookings`: Core reservation records with unique reference (`RST-YYYY-XXXX`), party counts, subtotal, pickup details, status (`confirmed`, `pending`, `cancellation_requested`, `cancelled`, `completed`), and payment status (`pending`, `paid`, `refunded`).
- `booking_extras`: Booked add-ons line items.
- `booking_passengers`: Full passenger manifest records for maritime coast guard compliance.

### 6. Traveler CRM & Concierge
- `inquiries`: Direct help requests and concierge inquiries submitted via website modals.
- `newsletter_subscriptions`: Traveler email subscriptions with assigned promo codes (`REDSEA15`) and source tracking.
- `reviews`: Verified traveler ratings and reviews with star scores.

### 8. CRM & Leads Pipeline
- `leads`: Full lead progression pipeline (`New`, `Contacted`, `Interested`, `Quotation Sent`, `Booking Pending`, `Booked`, `Completed`, `Lost`) with estimated value, tour interest, score, destination, and follow-up dates.
- `crm_lead_stages`: Configurable pipeline stages with customizable badges, colors, and win/loss flags.
- `crm_tasks`: Follow-ups and task queue with priorities (`Low`, `Medium`, `High`, `Urgent`), channel types, and due dates.
- `crm_conversations`: Persistent multi-channel conversation system (WhatsApp, Email, Phone, Web Chat) with honest provider state tracking (`resend`, `meta_whatsapp`, `unconfigured`).
- `crm_tags`: Admin-configured customer tags (`VIP`, `repeat_customer`, `family`, `diving`, `safari`, `high_value`).
- `crm_segments`: Dynamic rule-based customer segments and traveler cohorts with CSV export.
- `crm_communications`: Channel interaction logs (WhatsApp, Email, Phone, In-Person).
- `crm_notes`: Internal agent and concierge notes with pinning support.
- `crm_activities`: Unified chronological customer activity feed.

### 9. Operations & Fleet Dispatch
- `operational_assignments`: Daily departure assignments linking tour, date, time, vessel, and guide/captain.

### 10. Finance & Audit Trail
- `payment_transactions`: Immutable payment ledger (Cash, Card, Bank Transfer, Online Payment) with status (`Pending`, `Paid`, `Partially Paid`, `Failed`, `Refunded`).
- `refund_records`: Controlled refund audit records preventing silent modification of historical payments.
- `invoices`: Formal invoice generation with line items, tax, discounts, paid amount, and outstanding balances.

### 11. Communications & Notifications
- `communication_messages`: Full dispatch audit trail for Email and WhatsApp with delivery states (`Queued`, `Sent`, `Delivered`, `Failed`) and provider tracking.
- `communication_templates`: Reusable email and WhatsApp templates with dynamic variables (`{{customer_name}}`, `{{booking_reference}}`, `{{tour_name}}`, etc.).
- `staff_notifications`: Internal deduplicated staff notifications across 7 operational categories with severity levels.

### 12. Media Assets
- `media_assets`: Centralized media library tracking Supabase Storage paths, mime types, file sizes, and tour associations.

---

## 🛡️ Row-Level Security (RLS) Security Matrix

All 33 tables have RLS enabled. The security policy model enforces:

| Entity Type | Public (Anon) | Authenticated Customer | Admin / Staff |
|---|---|---|---|
| **Published Tours** | Read Only | Read Only | Full CRUD |
| **Draft / Archived Tours** | No Access | No Access | Full CRUD |
| **Destinations & Categories** | Read Only (Published) | Read Only (Published) | Full CRUD |
| **Pickup Locations & Extras** | Read Only (Active) | Read Only (Active) | Full CRUD |
| **User Profiles** | No Access | Read & Update Own | Full CRUD |
| **Customer Records** | Insert on Checkout | View/Update Own Record | Full CRUD |
| **Bookings** | Insert & Reference Lookup | View Own Linked Bookings | Full CRUD |
| **Cancellation Requests** | Update to `cancellation_requested` | Update Own Booking | Full CRUD |
| **Help Inquiries** | Insert New Inquiry | Insert New Inquiry | Full CRUD |
| **Newsletter Subscriptions** | Insert & Re-subscribe | Insert & Re-subscribe | Full CRUD |
| **Fleet & Crew** | Read Active | Read Active | Full CRUD |
| **Storage: `tour-media`** | Read Only | Read Only | Upload, Edit, Delete |
| **Storage: `vouchers`** | No Access | Read Own Vouchers | Full CRUD |

---

## 🔧 Troubleshooting & Diagnostics

### 1. `PGRST205: Could not find the table '...' in the schema cache`
- **Cause**: The PostgreSQL tables have not been created yet in Supabase.
- **Fix**: Open the Supabase **SQL Editor**, paste the contents of `/supabase/migrations/20260922000000_phase4_schema.sql`, and click **Run**.

### 2. `infinite recursion detected in policy for relation "profiles"`
- **Cause**: An older RLS policy evaluated `public.profiles` using a subquery that called `public.profiles` again.
- **Fix**: The migration uses the non-recursive `public.is_admin()` function with `SECURITY DEFINER` and statement-level `(SELECT auth.uid()) = id` caching. If upgrading an existing database, run `/supabase/migrations/20260928000000_fix_admin_auth_rls.sql`.

### 3. `Access Denied: Your account is currently assigned the "customer" role`
- **Cause**: Your user account exists, but has not yet been promoted to administrator.
- **Fix**: Run in the Supabase SQL Editor:
  ```sql
  SELECT public.set_admin_role_by_email('your-email@domain.com');
  ```

### 4. CORS or Network Errors When Calling Supabase
- **Cause**: Missing or incorrect `VITE_SUPABASE_URL` format.
- **Fix**: Ensure your URL follows `https://<project-ref>.supabase.co` without trailing slashes.

### 5. Images Failing to Upload in Admin CMS
- **Cause**: Storage bucket `tour-media` is missing or upload policy is restricted.
- **Fix**: Verify in **Storage** that `tour-media` is marked as a **Public bucket**, or re-run Section 6 of the migration script.
