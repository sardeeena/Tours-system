# 📘 Mahmoud CRM & Red Sea Excursions — Master Setup, Operations & Linking Manual

**Project:** Mahmoud CRM / Red Sea Excursions & Voyages  
**Production Web App:** [https://mahmoud-crm-eosin.vercel.app/](https://mahmoud-crm-eosin.vercel.app/)  
**Target Admin Email:** Configured by operator during setup (e.g. `admin@yourdomain.com`)  
**Target Database:** Supabase (PostgreSQL 15+)  
**Frontend & Edge Host:** Vercel  

---

## 📑 Manual Contents

1. [Prerequisites & Required Accounts](#1-prerequisites--required-accounts)
2. [Secrets & Environment Variables Inventory](#2-secrets--environment-variables-inventory)
3. [Supabase Database & Storage Setup](#3-supabase-database--storage-setup)
4. [Admin Account Setup & Elevation](#4-admin-account-setup--elevation)
5. [Vercel Hosting & Deployment Configuration](#5-vercel-hosting--deployment-configuration)
6. [Custom Domain & DNS Linking](#6-custom-domain--dns-linking)
7. [Supabase Auth & Email Templates Linking](#7-supabase-auth--email-templates-linking)
8. [Media Storage Bucket Configuration](#8-media-storage-bucket-configuration)
9. [Payment Gateways & Banking Setup](#9-payment-gateways--banking-setup)
10. [AI Capabilities (Google Gemini API)](#10-ai-capabilities-google-gemini-api)
11. [Catalogue Import Execution (When Ready)](#11-catalogue-import-execution-when-ready)
12. [Pre-Flight Verification & Launch Checklist](#12-pre-flight-verification--launch-checklist)

---

## 1. Prerequisites & Required Accounts

Before launching to production, you will need active accounts with the following services:

| Service | Purpose | Plan / Cost | Where to Register |
|---|---|---|---|
| **Supabase** | Authoritative PostgreSQL database, Auth, and Media Storage | Free tier or Pro ($25/mo for production scale) | [supabase.com](https://supabase.com) |
| **Vercel** | Production frontend hosting, CDN, edge routing, SSL certificates | Hobby (Free) or Pro ($20/mo) | [vercel.com](https://vercel.com) |
| **Google AI Studio** | Gemini AI API key for excursion concierge chat (`/api/chat`) | Pay-as-you-go or Free tier | [aistudio.google.com](https://aistudio.google.com) |
| **Custom Domain Registrar** | Your brand domain (e.g., Namecheap, Cloudflare, GoDaddy) | ~$10 - $15/year | Your chosen registrar |
| **Transactional Email / SMTP** | Email delivery for confirmations, password resets, vouchers (Resend, SendGrid, or Brevo) | Free tier available | [resend.com](https://resend.com) or [sendgrid.com](https://sendgrid.com) |
| **Payment Gateway** *(Optional)* | Online credit card processing (Stripe or PayPal) | Transaction fees (~2.9% + 30¢) | [stripe.com](https://stripe.com) |

---

## 2. Secrets & Environment Variables Inventory

The platform strictly separates public client configuration from server-only privileged secrets.

### 🌐 Client-Side Variables (Vite & Browser)
*These must be provided in `.env` and in your Vercel Project Settings > Environment Variables.*

| Variable Name | Required? | Description | Example Value |
|---|---|---|---|
| `VITE_SUPABASE_URL` | **YES** | The HTTPS endpoint for your Supabase project | `https://abcdefghijklmnop.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | **YES** | The public anonymous API key (safe for browser) | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

### 🔒 Server-Side Variables (Express Server / API Routes)
*These are NEVER exposed to client browsers or bundled into frontend JavaScript.*

| Variable Name | Required? | Description | Where to Provide |
|---|---|---|---|
| `GEMINI_API_KEY` | **YES** *(for AI chat)* | Google Gemini API key for excursion recommendations | AI Studio Secrets / Vercel Env Vars |
| `APP_URL` | **YES** | Canonical production web address | `https://mahmoud-crm-eosin.vercel.app` |
| `PORT` | Optional | Port for the backend Express server (defaults to 3000) | Automatically managed by Cloud Run / Node |
| `STRIPE_SECRET_KEY` | Optional | Secret key for live online card processing | Server-side only (when Stripe activated) |
| `STRIPE_WEBHOOK_SECRET` | Optional | Signature secret for verifying Stripe webhook events | Server-side only (when Stripe activated) |

---

## 3. Supabase Database & Storage Setup

The database architecture consists of **55 normalized tables**, **15 PostgreSQL stored procedures & triggers**, and Row-Level Security (RLS) policies.

> ⚠️ **CRITICAL RELEASE GATE: FRESH INSTALLATION VS. EXISTING PRODUCTION DATABASE**  
> - **Fresh Project Setup**: If initializing a new or staging Supabase project with 0 existing data, execute `/complete_schema.sql` in full.
> - **Existing Production Database**: If your database is already in production and contains live bookings, customer accounts, or fleet schedules, **DO NOT** re-run `/complete_schema.sql` in its entirety. Instead, verify schema health via `npm run test:parity` and apply only required incremental migrations from `supabase/migrations/` sequentially.

### Track A: Fresh Project Setup (Single-File Provisioning)

1. Log into your [Supabase Dashboard](https://supabase.com/dashboard).
2. Create a new project (e.g., `mahmoud-crm-production`), choose an appropriate region (e.g., `Frankfurt` or `London`), and save your database password.
3. Open the **SQL Editor** tab from the left sidebar.
4. Click **New query**.
5. Copy the entire contents of the canonical master schema file:
   ```
   /complete_schema.sql
   ```
   *(Located in the root of this project repository, containing ~3,500 lines of fully idempotent PostgreSQL).*
6. Paste the SQL into the editor and click **Run** (or press `Cmd/Ctrl + Enter`).
7. Confirm that the output reports `Success. No rows returned`.

### Track B: Existing Production Database Maintenance

1. In your local or CI terminal, run:
   ```bash
   npm run test:parity
   ```
2. The anti-divergence engine will compare your 17 migration files against `complete_schema.sql` across all 55 tables and 15 functions.
3. If an existing database lacks specific updates (e.g., the atomic rate limiters in `20261016000000_hardened_abuse_prevention_and_atomic_rate_limits.sql`), apply only that specific migration file in the SQL Editor.

### Verify Database Tables:
Navigate to **Database > Tables** in Supabase and confirm that the core tables are present:
- `tours`, `tour_itineraries`, `tour_highlights`, `tour_faqs`, `tour_inclusions`, `tour_exclusions`, `tour_images`, `tour_categories`
- `destinations`, `categories`
- `bookings`, `booking_passengers`, `booking_extras`, `tour_availability`
- `customers`, `profiles`, `leads`, `crm_tasks`, `crm_activities`, `crm_notes`
- `vessels`, `guides`, `operational_assignments`
- `reviews`, `coupons`, `tour_extras`, `pickup_locations`
- `payment_transactions`, `invoices`, `refunds`, `payment_providers`
- `inquiries`, `newsletter_subscriptions`, `communication_templates`, `sent_messages`, `automation_events`
- `media_assets`, `rate_limit_buckets`

---

## 4. Admin Account Setup & Elevation

To access the administrative CMS (`/admin`), your account must exist in `auth.users` and have the `admin` or `super_admin` role in `public.profiles`.

### Step-by-Step Provisioning:

1. **Register the Account**:
   - Open your deployed application URL (or local dev server) in your browser.
   - Click **Sign In** in the top navigation or navigate to `/register`.
   - Sign up with your intended administrator email (e.g., `admin@yourdomain.com`).
   - Enter your name and create a strong password (minimum 8 characters, with letters and numbers).
   - Submit the registration form.

2. **Elevate to Administrator in Supabase**:
   - Go to **Supabase Dashboard > SQL Editor**.
   - Create a new query and run:
     ```sql
     SELECT public.set_admin_role_by_email('admin@yourdomain.com');
     ```
   - The query will return:
     ```
     Success: Account admin@yourdomain.com (User ID: ...) is now an active administrator with verified role "admin".
     ```

### Security Architecture & Least-Privilege Protection:
- **Execution Boundary**: `REVOKE ALL ON FUNCTION public.set_admin_role_by_email(text) FROM PUBLIC, anon, authenticated;`  
  Only trusted database operators (`session_user IN ('postgres', 'service_role')`) can execute the function. Anonymous or standard authenticated users are strictly blocked.
- **Nonce Handshake with `protect_profile_role`**: The function generates a transaction-scoped cryptographic nonce (`app.admin_provisioning_nonce`) and binds it to `app.admin_provisioning_active_user`. The table trigger `protect_profile_role()` validates that the calling session is trusted and matches the target user ID before permitting the role update from `'customer'` to `'admin'`.
- **JWT App Metadata Synchronization**: The procedure updates server-controlled `raw_app_meta_data->>'role' = 'admin'` in `auth.users`, ensuring the next token refresh contains the verified admin claim while remaining immutable to client-side manipulation.
- **Post-Update Verification**: The function performs an internal assert query against `public.profiles` to confirm the role persisted as `'admin'` before emitting success.

3. **Log in to Admin Dashboard**:
   - Navigate to `/admin` or `/admin/login`.
   - Sign in with `admin@yourdomain.com` and your password.
   - You will have full access to all 15 management modules.

---

## 5. Vercel Hosting & Deployment Configuration

The application is deployed on Vercel as a high-performance Single Page Application (SPA) with service worker caching and API proxy routing.

### Step-by-Step Vercel Setup:

1. Log into [Vercel](https://vercel.com) and click **Add New... > Project**.
2. Import the GitHub repository: `sardeeena/Mahmoud-crm`.
3. Configure the **Build & Development Settings**:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
4. Expand **Environment Variables** and add the following:
   - `VITE_SUPABASE_URL`: Your Supabase project URL (e.g., `https://your-project.supabase.co`)
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous public key
   - `GEMINI_API_KEY`: Your Google Gemini API key
   - `APP_URL`: `https://mahmoud-crm-eosin.vercel.app` (or your custom domain)
5. Click **Deploy**.
6. The repository includes a pre-configured `vercel.json` file that ensures:
   - Client-side deep linking works for all routes (`/admin/*`, `/excursions/*`, `/my-booking/*`, `/booking/confirmation/*`).
   - Static assets (`/assets/*`) are cached with long-lived immutable headers.
   - `/api/*` routes are handled without HTML fallbacks.

---

## 6. Custom Domain & DNS Linking

If you are linking a custom domain (e.g. `www.redseavoyages.com` or `excursions.yourdomain.com`):

1. In your **Vercel Project Dashboard**, go to **Settings > Domains**.
2. Type your domain name (e.g., `redseavoyages.com`) and click **Add**.
3. Vercel will provide the required DNS records:
   - **Apex domain (`redseavoyages.com`)**:
     - Type: `A`
     - Name: `@`
     - Value: `76.76.21.21`
   - **Subdomain (`www.redseavoyages.com`)**:
     - Type: `CNAME`
     - Name: `www`
     - Value: `cname.vercel-dns.com`
4. Log into your domain registrar (Namecheap, GoDaddy, Cloudflare, etc.) and add these records in your DNS Management settings.
5. Vercel automatically issues and renews a free Let's Encrypt SSL/TLS certificate once DNS propagation completes (typically 5 to 30 minutes).

---

## 7. Supabase Auth & Email Templates Linking

To ensure confirmation emails and password reset links return users to your production domain:

1. In your **Supabase Dashboard**, navigate to **Authentication > URL Configuration**.
2. Set the **Site URL**:
   ```
   https://mahmoud-crm-eosin.vercel.app
   ```
   *(Or your custom domain, e.g. `https://www.redseavoyages.com`)*.
3. Under **Redirect URLs**, add the following authorized callback paths:
   - `https://mahmoud-crm-eosin.vercel.app/**`
   - `https://mahmoud-crm-eosin.vercel.app/reset-password`
   - `https://mahmoud-crm-eosin.vercel.app/my-booking/**`
   - `http://localhost:3000/**` *(for local development)*
4. Under **Authentication > Email Templates**:
   - **Reset Password (Standard & Recommended)**:  
     Retain Supabase's built-in default email template using the official confirmation URL variable:
     ```html
     <h2>Reset Password</h2>
     <p>Follow this link to reset the password for your user:</p>
     <p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
     ```
     *How it works*: When the traveler clicks the link, Supabase's auth service verifies the request and seamlessly redirects to your configured Redirect URL (`https://mahmoud-crm-eosin.vercel.app/reset-password`), passing either PKCE authorization credentials (`?code=...`) or session hash tokens. The application's `ResetPasswordPage` automatically detects the event and opens the new password entry form.

   - **Reset Password (Direct Custom Token-Hash Alternative)**:  
     If you choose to bypass Supabase's redirect server and link directly into your app using `{{ .TokenHash }}`, the official Supabase specification requires using the `token_hash` query parameter with `type=recovery`:
     ```html
     <h2>Reset Password</h2>
     <p>Follow this link to reset the password for your user:</p>
     <p><a href="{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&type=recovery">Reset Password</a></p>
     ```
     *How it works*: The `ResetPasswordPage` reads `token_hash` from the URL query string and calls `supabase.auth.verifyOtp({ token_hash, type: 'recovery' })`.

   - ⚠️ **What NOT to do**: Never place `{{ .TokenHash }}` inside a URL hash fragment labeled `access_token` (e.g. `#access_token={{ .TokenHash }}`). An OTP token hash is NOT an access token. Doing so causes Supabase session parser errors.

   - **Confirm Signup**:  
     Use the standard confirmation link:
     ```html
     <p><a href="{{ .ConfirmationURL }}">Confirm your email</a></p>
     ```
     Or direct callback: `{{ .SiteURL }}/login?confirmed=true`.
5. *(Optional for high delivery)*: Go to **Project Settings > Authentication > SMTP Settings** and connect a custom SMTP provider (e.g. Resend, Brevo, or SendGrid) to prevent confirmation and recovery emails from landing in spam folders.

---

## 8. Media Storage Bucket Configuration

The platform requires a public storage bucket named **`tours`** for excursion gallery photos, videos, and media library assets.

### Step-by-Step Storage Setup:

1. In **Supabase Dashboard**, navigate to **Storage > Buckets**.
2. Verify if the bucket **`tours`** exists:
   - If missing, click **New bucket**.
   - Name: `tours`
   - Public bucket: **Enabled** (toggle ON so travelers can view excursion photos).
   - Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/avif`, `video/mp4`, `video/webm`
   - Max file size limit: `52428800` (50 MB).
3. Click **Save bucket**.
4. The schema in `/complete_schema.sql` automatically applies storage RLS policies:
   - Anyone (anonymous) can view (`SELECT`) files in the `tours` bucket.
   - Only authenticated administrators can upload (`INSERT`), update (`UPDATE`), or delete (`DELETE`) files.

---

## 9. Payment Gateways & Banking Setup

The platform supports both in-person payment collections and online gateways.

### Active Default Method: In-Person Collection (Zero Commission)
By default, the platform supports:
- **Marina Office Cash Desk**: Guests pay cash (EUR, USD, GBP, EGP) at the pier desk.
- **Pier Mobile POS Terminal**: Chip & PIN / Contactless card terminals operated by staff.
- **Bank Wire Transfer**: Commercial International Bank (CIB Egypt) account wire.

### Activating Online Payments (Stripe):
If you wish to accept credit card payments online during checkout:
1. In your [Stripe Dashboard](https://dashboard.stripe.com), obtain your **Publishable Key** (`pk_live_...`) and **Secret Key** (`sk_live_...`).
2. Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to your server environment variables in Vercel.
3. In the admin dashboard under **Finance > Settings**, toggle Stripe from `Disconnected` to `Connected`.

---

## 10. AI Capabilities (Google Gemini API)

The platform includes an AI-powered Red Sea excursion concierge chatbot:
1. Visit [Google AI Studio](https://aistudio.google.com/) and click **Get API Key**.
2. Copy your key.
3. Add the key as `GEMINI_API_KEY` in your Vercel Project Environment Variables.
4. The application proxies queries securely through the server route `/api/chat` so your Gemini key is never exposed to visitors.

---

## 11. Catalogue Import Execution (When Ready)

The complete excursion catalogue (365 relational records across 13 master tours, 7 coastal destinations, 6 excursion categories, 7 hotel pickup zones, 6 booking extras, and 326 child relation records) has been fully prepared and validated in dry-run mode (`scripts/import_catalogue_to_supabase.ts`).

### Authoritative Entity Breakdown:
- **Master Excursions**: 13 (Orange Bay, Paradise Island, Dolphin House, Giftun Island, VIP Yacht, Glass Bottom Boat, Quad Desert Safari, Super Mega Safari, Quad & Camel Sunset, Star Gazing Safari, Scuba Diving Adventure, Parasailing & Water Sports, Private Speedboat Dolphin Safari)
- **Coastal Destinations**: 7 (Hurghada, El Gouna, Makadi Bay, Sahl Hasheesh, Safaga, Sharm El-Sheikh, Marsa Alam)
- **Excursion Categories**: 6 (Boat Trips, Snorkeling, Diving, Safari, Private Tours, Water Sports)
- **Pickup Locations**: 7 standardized hotel pickup clusters
- **Booking Extras**: 6 optional add-ons (underwater photography, private guide, private transfers, extra dives, seafood lunch, GoPro rental)
- **Relational Child Records**: 326 (29 category links, 31 gallery images, 79 itinerary timeline steps, 62 highlights, 64 inclusions, 25 exclusions, 16 FAQs, 7 guest reviews, 13 SEO definitions)
- **Total Relational Records**: 365

### Strict Safety Rules:
- The script defaults to **DRY-RUN mode** (0 database writes).
- It will NOT execute live mutations unless explicitly instructed.
- When you are ready to populate your fresh Supabase database with the complete catalogue:

```bash
# Execute live import with strict safety confirmation
CONFIRM_LIVE_IMPORT=true npx tsx scripts/import_catalogue_to_supabase.ts --write
```

This will idempotently upsert all 13 excursions, 7 destinations, 6 categories, and their child relations into your Supabase database using deterministic RFC-4122 UUIDs.

---

## 12. Pre-Flight Verification & Launch Checklist

Run through this final checklist prior to announcing the website:

- [ ] **Run All Automated Tests**:
  ```bash
  npm run test:all
  ```
  *(Verify that all 8 test suites pass: catalogue dry-run, schema parity, admin security, abuse prevention, SPA routing, admin persistence, password recovery, and communication credential validation).*
- [ ] **Run Individual Test Commands**:
  - `npm run test:catalogue`
  - `npm run test:parity`
  - `npm run test:admin`
  - `npm run test:security`
  - `npm run test:abuse`
  - `npm run test:routes`
  - `npm run test:recovery`
  - `npm run test:comm`
- [ ] **Run Linter**:
  ```bash
  npm run lint
  ```
  *(Confirms 0 TypeScript compilation errors).*
- [ ] **Verify Production Build**:
  ```bash
  npm run build
  ```
  *(Confirms clean production bundle generation in `dist/`).*
- [ ] **Test Admin Login**:
  - Visit `/admin/login`
  - Sign in with your registered admin email (`admin@yourdomain.com`)
  - Verify that the Dashboard, Tours, Bookings, Operations, CRM, Reviews, and Finance tabs load without errors.
- [ ] **Test Guest Booking Flow**:
  - Visit the homepage `/`
  - Select an excursion (e.g. *Orange Bay Island Snorkeling*)
  - Click **Book Now**
  - Complete the 3-step checkout with test guest details
  - Confirm that a voucher reference (`RST-XXXX-XXXX`) is issued and visible under `/admin/bookings`.
- [ ] **Test Inquiry & Newsletter Form**:
  - Submit an inquiry on the Contact page
  - Confirm receipt in `/admin/inquiries` and `/admin/crm/leads`.
  - Submit a newsletter email in the footer
  - Confirm receipt in `/admin/newsletter` with promo code `REDSEA15`.
- [ ] **Check PWA & Mobile Responsiveness**:
  - Test on iOS Safari and Android Chrome
  - Confirm mobile navbar, touch gestures, and service worker registration.
