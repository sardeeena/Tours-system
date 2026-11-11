# 🚀 Complete Website & Supabase Setup Guide

> Step-by-step tutorial to run, configure, and publish **Red Sea Excursions & Voyages** with a live **Supabase** backend.

---

## 📋 Table of Contents
1. [Prerequisites](#-prerequisites)
2. [Step 1: Install Dependencies](#-step-1-install-dependencies)
3. [Step 2: Configure Environment Variables](#-step-2-configure-environment-variables)
4. [Step 3: Run the Local Development Server](#-step-3-run-the-local-development-server)
5. [Step 4: Set Up the Supabase Database](#-step-4-set-up-the-supabase-database)
6. [Step 5: Create and Promote an Admin Account](#-step-5-create-and-promote-an-admin-account)
7. [Step 6: Test Website & Database Integration](#-step-6-test-website--database-integration)
8. [Step 7: Production Build & Deployment](#-step-7-production-build--deployment)
9. [Pre-Launch Checklist](#-pre-launch-checklist)

---

## 🛠️ Prerequisites

Before you start, ensure you have:
- **Node.js** (v18.0.0 or higher) or **Bun** installed on your computer.
- A free account on [Supabase](https://supabase.com).
- A modern web browser.

---

## 📦 Step 1: Install Dependencies

From the project root directory, install all required packages:

```bash
npm install
```

---

## 🔑 Step 2: Configure Environment Variables

Create a file named `.env` in the root of the project:

```bash
cp .env.example .env
```

Open `.env` and fill in your Supabase project credentials:

```env
# Supabase Project API Credentials
# Found in: Supabase Dashboard > Project Settings > API
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

*(Note: If you do not have Supabase credentials yet, the application will automatically run in local browser storage mode until you configure them.)*

---

## 💻 Step 3: Run the Local Development Server

Start the Vite development server:

```bash
npm run dev
```

Open your browser to:
```
http://localhost:3000
```

You should see the Red Sea Excursions homepage with the dynamic hero banner, popular excursions, categories, and destinations.

---

## 🗄️ Step 4: Set Up the Supabase Database

To connect the real relational database:

### 1. Create a Supabase Project
1. Log in to [Supabase](https://supabase.com) and click **New Project**.
2. Name the project (e.g. `Red Sea Excursions`), choose a database password, and pick the cloud region closest to your users.
3. Once the database is ready, go to **Project Settings > API** and copy:
   - **Project URL**
   - **Project API Keys > `anon` `public`**

### 2. Run the Schema Migration (Complete Relational Schema, Triggers & RLS)
1. In your Supabase Dashboard, click **SQL Editor** on the left menu.
2. Click **New query**.
3. Open the file `/complete_schema.sql` from this codebase (contains the canonical consolidated schema covering all 54 tables: catalog, bookings, CMS, CRM, Operations, Finance, Communications, and Media Assets, plus secure RPCs and storage policies).
4. Copy the entire contents, paste it into the Supabase SQL Editor, and click **Run**.
5. You should see: `Success. No rows returned.`

### 3. Seed Production Catalog Data
1. In the Supabase **SQL Editor**, click **New query**.
2. Open `/supabase/seed.sql` from this codebase.
3. Copy the entire contents, paste it into the editor, and click **Run**.
4. This populates genuine coastal destinations (Hurghada, El Gouna, Makadi Bay, Safaga, Sahl Hasheesh), categories, pickup locations, optional extras, fleet vessels, guides, and initial published excursions with detailed itineraries. Zero fake bookings are inserted.

---

## 👑 Step 5: Create and Promote an Admin Account

To access the administrative dashboard at `/admin`, provision the official administrator account (`admin@awesomeadventure.tours`) using the secure server-side setup script or the SQL seed:

### Method A: Automated Server-Side Admin Setup (Recommended)
This uses the official Supabase Auth Admin API and avoids storing plaintext passwords anywhere in the repository:

```bash
SUPABASE_SERVICE_ROLE_KEY="<your-supabase-service-role-key>" \
ADMIN_PASSWORD="<your-secure-admin-password>" \
npx tsx scripts/setup-admin.ts
```

What this does:
1. Connects securely to the Supabase Auth Admin API using the private `service_role` key.
2. Creates or verifies the user `admin@awesomeadventure.tours` in `auth.users` with email confirmed.
3. Automatically sets or validates the user metadata `role: 'admin'`.
4. Provisions or repairs the matching `public.profiles` record with `role = 'admin'` and `is_email_verified = TRUE`.
5. Safe to rerun repeatedly at any time.

### Method B: Database SQL Verification (`admin_seed.sql`)
Once the Auth user has been created in your Supabase project (either via the script above or via Dashboard > Authentication > Users > Add User):
1. In the Supabase Dashboard, open **SQL Editor**.
2. Run `/admin_seed.sql` (or `/supabase/admin_seed.sql`).
3. This verifies the `auth.users` entry and upserts the canonical `public.profiles` record with the authoritative `admin` role without touching internal auth tables or passwords.

---

## 🧪 Step 6: Test Website & Database Integration

1. **Verify Connection**:
   - Go to `/admin` > **Settings**.
   - Click **Test Connection**. A green badge should confirm `Connected (Live Supabase integration active)`.
2. **Test Excursion Browsing**:
   - Go to `/excursions`. Filter by destination, category, and date.
   - Click any excursion card to view the minute-by-minute itinerary, inclusions, and photo gallery.
3. **Test Booking Flow**:
   - Click **Book Excursion**.
   - Select departure date, guest count, hotel pickup location, and optional extras.
   - Fill in traveler details and select **Pay at Hotel Pickup**.
   - Submit the booking to receive your unique booking reference (`RST-YYYY-XXXX`).
   - Check `/admin` > **Bookings** to verify your new reservation appears in real time.
4. **Test Concierge Help Inquiry**:
   - Click **Require Help** in the header or footer.
   - Fill in your name, contact details, and message.
   - Submit and verify it appears under `/admin` > **Help Inquiries**.
5. **Test Newsletter Subscription**:
   - Scroll to the footer newsletter box.
   - Enter your email and click subscribe.
   - Receive the `REDSEA15` voucher code and verify your email is recorded under `/admin` > **Newsletter**.

---

## 🚢 Step 7: Production Build & Deployment

To build the project for production:

```bash
npm run build
```

This compiles optimized client bundles into the `dist/` folder.

To test the production build locally:

```bash
npm run preview
```

### Deploying to Production Platforms
- **Vercel / Netlify / Cloudflare Pages**:
  - Build command: `npm run build`
  - Output directory: `dist`
  - Environment variables: Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- **Node.js / Express Server**:
  - Run `npm start` (which runs `node server.ts` or `tsx server.ts`).
  - Dev server listens on port `3000`.

---

## ✅ Pre-Launch Checklist

- [x] All mock and demo data removed from database seed files.
- [x] All 33 tables enabled with PostgreSQL Row Level Security (RLS).
- [x] Production catalog seeded with genuine Red Sea tours and destinations.
- [x] Supabase Auth configured with Redirect URLs.
- [x] Administrator account promoted via `public.set_admin_role_by_email()`.
- [x] Storage buckets `tour-media`, `avatars`, and `vouchers` provisioned.
- [x] Input sanitization, password strength validation, and rate limiters active.
- [x] SEO meta tags, OpenGraph images, and canonical URL structure synced.
- [x] Mobile responsiveness and PWA icons verified across devices.
