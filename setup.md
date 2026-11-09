# 🚀 Red Sea Voyages & Mahmoud CRM — Quick Setup Guide

This guide walks you through connecting your Supabase project, executing the database schema and storage provisioning, configuring your administrator account, and verifying your installation.

For a full breakdown of every account, secret, and external integration required for production, refer to [**manual.md**](./manual.md).

---

## 🏗️ Architecture Overview

The application utilizes Supabase for:
1. **PostgreSQL Relational Database**: 55 normalized tables storing excursions, itineraries, categories, destinations, hotel pickup locations, extras, customer reservations, inquiries, reviews, newsletter subscribers, CRM leads, fleet vessels, guide staff, payment transactions, and communications (including `rate_limit_buckets`).
2. **Supabase Authentication**: Secure user registration, password reset, session management, and Role-Based Access Control (RBAC) via `public.profiles`.
3. **Supabase Storage**:
   - `tours` (Public, up to 50MB): Excursion photo galleries, videos, and promotional banners.
   - `avatars` (Public, up to 5MB): Traveler profile avatars.
   - `vouchers` (Private, up to 10MB): PDF booking vouchers and manifests.
4. **Row-Level Security (RLS)**: Enforces public read access on published excursions while restricting mutations strictly to administrators.

---

## Step 1: Obtain Supabase Project Credentials

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard) and open your project (or create a new one).
2. In the left navigation, click on **Project Settings** (gear icon) > **API**.
3. Locate the following two values:
   - **Project URL** (e.g., `https://abcdefghijklm.supabase.co`)
   - **Project API Keys** > `anon` `public` key (e.g., `eyJhbGciOi...`)

---

## Step 2: Configure Environment Credentials

You can configure your Supabase credentials in either of two ways:

### Option A: Via the Admin Settings UI (Instant, No Restart Required)
1. Open the application in your browser and navigate to `/admin/settings`.
2. Paste your **Supabase Project URL** and **Anon Public Key** into the connection fields.
3. Click **Save & Test Connection**. The app will immediately ping your PostgreSQL database.

### Option B: Via `.env` File
Create or update the `.env` file in your project root:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
GEMINI_API_KEY=your-gemini-key-here
APP_URL=https://mahmoud-crm-eosin.vercel.app
```

---

## Step 3: Database Schema & Migration Strategy

> ⚠️ **CRITICAL SAFETY WARNING FOR EXISTING DATABASES**:  
> If you are deploying to an **existing production database** that already contains live bookings, customer accounts, or operational records, **DO NOT** execute `/complete_schema.sql` indiscriminately. Instead, apply the ordered incremental migrations from `supabase/migrations/` sequentially.  
> 
> Running `/complete_schema.sql` in its entirety is designed for **fresh Supabase projects** only.

### For Fresh Projects:
1. In your [Supabase Dashboard](https://supabase.com/dashboard), navigate to **SQL Editor** in the left menu.
2. Click **New Query**.
3. Open the canonical authoritative schema file **`/complete_schema.sql`** in this project repository.
4. Paste the entire content into the SQL Editor and click **Run**.
5. You should see a success message: `Success. No rows returned`.

### For Existing Projects:
1. Audit your database schema using the Table Audit in `/admin/settings` or run:
   ```bash
   npm run test:parity
   ```
2. Apply missing incremental migrations from `supabase/migrations/` in chronological order via the Supabase CLI or SQL Editor.

---

## Step 4: Administrator Account Setup & Promotion

To access the CMS Admin Dashboard (`/admin`), your account must have the `admin` or `super_admin` role assigned in `public.profiles`.

### 1. Register Your Account
1. Open the application in your browser.
2. Click **Sign In** in the top navigation or go to `/register`.
3. Sign up with your intended administrator email (e.g., `admin@yourdomain.com`).
4. Set a secure password and submit.

### 2. Promote Account to Administrator in Supabase
Once your account has registered, promote it using the built-in helper function.
1. Open **Supabase Dashboard > SQL Editor**.
2. Run the following command with your registered admin email:
   ```sql
   SELECT public.set_admin_role_by_email('admin@yourdomain.com');
   ```
3. The SQL Editor will return:
   ```
   Success: Account admin@yourdomain.com (User ID: ...) is now an active administrator with verified role "admin".
   ```

---

## Step 5: Log into the CMS Admin Dashboard

1. Navigate to `/admin` or `/admin/login`.
2. Sign in with your registered admin email and password.
3. You will have full access to:
   - **Executive & BI Analytics**: Real-time revenue counters, passenger counts, conversion metrics.
   - **Tours & Excursions**: Complete CRUD for tour parameters, itineraries, highlights, FAQs, inclusions, and exclusions.
   - **Bookings & Reservations**: Status transitions (`pending`, `confirmed`, `cancellation_requested`, `cancelled`), hotel pickup details, and notes.
   - **Fleet & Operations**: Daily departures, vessel management, guide rosters, and manifest exports.
   - **CRM**: Leads pipeline, customer profiles, tasks, notes, and activity timeline.
   - **Reviews & Moderation**: Verified guest review moderation and star breakdowns.
   - **Coupons & Promos**: Code creation, percentage/fixed discounts, usage limits, and expiration dates.
   - **Finance**: Payments ledger, invoice generation with PDF printing, and refund processing.
   - **Media Library**: Upload and manage media assets in the `tours` Supabase Storage bucket.

---

## Step 6: Verify Installation

Run the complete automated test suite to ensure the platform is ready:

```bash
# Run all 8 automated test suites
npm run test:all

# Run individual test suites
npm run test:catalogue   # Validates catalogue records & RFC-4122 UUIDs (dry-run)
npm run test:parity      # Validates 55 tables & 15 functions anti-divergence
npm run test:security    # Validates admin privilege escalation defenses
npm run test:abuse       # Validates bot honeypots & atomic rate limiters
npm run test:routes      # Validates Vercel SPA rewrites & deep routes
npm run test:admin       # Validates admin persistence & RLS error surfacing
npm run test:recovery    # Validates password recovery & session security
npm run test:comm        # Validates communication provider credential enforcement

# Run TypeScript linter
npm run lint

# Build production bundle
npm run build
```

For complete deployment details including Vercel settings, DNS records, and email SMTP configuration, see [**manual.md**](./manual.md).
