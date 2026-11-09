# 🌴 Awesome Adventure Tours (Mahmoud CRM & Excursion Platform)

> An enterprise-grade, full-stack tour operator, excursion booking platform, and administrative CRM specializing in Red Sea marine adventures, island boat trips, coral reef snorkeling, PADI scuba diving, and desert quad safaris.

[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%2015-3ECF8E?logo=supabase)](https://supabase.com/)
[![PWA](https://img.shields.io/badge/PWA-Ready-orange?logo=pwa)](https://web.dev/progressive-web-apps/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 📑 Table of Contents

1. [Project Overview](#-project-overview)
2. [Recent Updates & Enhancements](#-recent-updates--enhancements)
3. [Documentation Guides](#-documentation-guides)
4. [Key Capabilities & Features](#-key-capabilities--features)
5. [Admin CMS, Operations, CRM & Finance](#-admin-cms-operations-crm--finance)
6. [Architecture & Tech Stack](#-architecture--tech-stack)
7. [Database & Supabase Integration](#-database--supabase-integration)
8. [Project Structure](#-project-structure)
9. [Getting Started & Local Development](#-getting-started--local-development)
10. [Environment Variables](#-environment-variables)
11. [Automated Testing & Verification](#-automated-testing--verification)
12. [Production Build & Deployment](#-production-build--deployment)
13. [License](#-license)

---

## 🌟 Project Overview

**Awesome Adventure Tours** delivers a premier direct-to-consumer adventure tourism experience alongside a comprehensive operations management engine. It connects international holidaymakers across Egypt (Hurghada, El Gouna, Sahl Hasheesh, Makadi Bay, Safaga, Marsa Alam) with verified local sea captains, desert safari guides, and PADI-certified divemasters.

The platform provides real-time excursion discovery, automated multi-step booking workflows, hotel pickup coordination, PDF voucher generation, wishlist management, interactive customer accounts, and a 15-module administration dashboard.

---

## 🆕 Recent Updates & Enhancements

### 🏷️ 1. Platform Rebranding
- Rebranded from "Red Sea Voyages" to **Awesome Adventure Tours** across:
  - Public website navbar, hero, footer, and interactive excursion cards
  - HTML title tags, OpenGraph social sharing meta, and SEO schema services
  - Customer booking vouchers and confirmation modals
  - Admin CMS layout, sidebar, login portal, and system branding

### 📱 2. Admin Navigation & Responsive Layout Controls
- **Collapsible Sidebar with Open/Close Controls:**
  - Header toggle button (`PanelLeftClose` / `PanelLeftOpen`) with tooltip and smooth animated transitions.
  - In-sidebar collapse button (`ChevronLeft` / `X`) allowing admins to minimize the navigation rail for maximum screen workspace.
  - Off-canvas slide-over drawer with backdrop overlay on mobile screens to ensure the navigation never obstructs content.
- **Real-Time Device Detection:**
  - Dynamic detection badge displaying the current physical viewport: `Phone (< 768px)`, `Tablet (768px – 1024px)`, or `PC (> 1024px)` with live pixel resolution indicators.
- **Multi-Device Viewport Preview Switcher:**
  - Interactive preview switcher enabling administrators to simulate and test dashboard modules in **Auto (Fluid)**, **PC (1280px)**, **Tablet (768px)**, and **Phone (390px)** modes with simulated hardware bezels.

### 🖼️ 3. "Choose from Media Library" in Tour Creation & Editing
- **Media & Storage Tab Tour Picker (`AdminMediaManager.tsx`):**
  - Integrated direct selection from the centralized Media Library when creating or editing tours.
  - **Multi-Selection:** Choose multiple uploaded photos at once with live selection count indicators.
  - **Live Filter & Search:** Search media assets by filename or title with real-time text matching.
  - **Filter Tabs:** Quickly toggle between `All Media`, `Not in Tour` (unattached images), and `Already in Tour`.
  - **Visual In-Tour Badges:** Clear indicator badges on images already linked to the active tour.
  - **Instant Cover Assignment:** One-click "Set as Cover" action within the picker modal.
  - **Master Asset Protection:** Removing an image from a tour only unlinks it from the tour record; it does not delete the master file from Supabase Storage or the central library.
  - **Synchronized Asset Feeds:** Seamlessly aggregates cloud-synced Supabase assets and local session uploads via `storageService.ts`.

---

## 📖 Documentation Guides

We provide specialized guides depending on your role:

- 📘 [**Master Operations & Linking Manual (manual.md)**](./manual.md) — **Essential for Launch:** Exhaustive, step-by-step instructions on every third-party account, secret key, environment variable, DNS record, Vercel build setting, Supabase storage bucket, and payment provider setup.
- 🚀 [**Quick Setup Guide (setup.md)**](./setup.md) — Fast-track instructions for connecting Supabase, running the master SQL migration, and elevating your administrator account.
- 📋 [**Phase 4 Implementation Report (PHASE_4_COMPLETION_REPORT.md)**](./PHASE_4_COMPLETION_REPORT.md) — Technical audit of repaired data layers, honest empty states, and RBAC authorization.
- 📋 [**Catalogue Import Dry-Run Report (CATALOGUE_IMPORT_DRY_RUN_REPORT.md)**](./CATALOGUE_IMPORT_DRY_RUN_REPORT.md) — Pre-flight dry-run validation report of the 365 relational catalog entities.

---

## 🚀 Key Capabilities & Features

### 🏖️ Guest & Discovery Experience
- **Cinematic Dynamic Hero**: Rotating showcase spanning 5 excursion categories (Island & Snorkeling, Desert Safari, PADI Scuba, Luxury Private Yachts, and Water Sports) with synchronized headlines, localized marine telemetry, and live conditions.
- **Parametric Search & Filtering**: Multi-criteria search engine filtering by destination, activity category, guest count, price tier, duration, and departure date.
- **Skeleton Shimmer Loaders**: Full-layout skeleton loaders for the home grid, excursions page, and detailed tour pages ensuring zero cumulative layout shift (CLS).
- **Tour Detail Pages**:
  - High-resolution interactive media gallery with lightbox support.
  - Granular minute-by-minute itinerary timeline.
  - Comprehensive Inclusions vs. Exclusions breakdown.
  - What to Bring & Important Regulations checklists.
  - Live verified guest reviews with star breakdown distributions.
  - Dynamic pickup add-on selector and optional upgrades (e.g., underwater GoPro rentals, VIP seafood lunch).

### 💳 Booking & Reservation Flow
- **Direct 3-Step Checkout Modal**:
  1. Date & party selection (adults, children, infants) with live capacity validation.
  2. Resort lobby pickup specification with optional area surcharges (El Gouna, Makadi Bay, Soma Bay).
  3. Lead passenger contact details, special requests, and payment selection (`Pay at Pickup` cash/card or online options).
- **Instant Booking Confirmation**: Generates a unique booking reference (`AAT-XXXX-XXXX`) with downloadable digital voucher summaries.
- **Draft Autosave**: Automatically preserves uncompleted booking state in browser local storage so guests never lose progress.

### 👤 Customer Voyager Portal
- **Supabase Authentication**: Email/password registration, secure login, password reset flow, and auto-profile syncing via PostgreSQL triggers.
- **My Bookings Dashboard**: History of upcoming, completed, and cancellation-requested tours.
- **Live Digital Vouchers**: Direct print and voucher inspection modal with barcode generation and hotel meeting point info.
- **Wishlist & Saved Tours**: Fast off-canvas drawer to save favorite excursions with real-time counters.

---

## 🛡️ 15-Module Executive Admin Dashboard

1. **Executive & BI Analytics**: Real-time revenue counters, passenger counts, conversion metrics, and date-range filters (`today`, `this_week`, `this_month`, `last_month`, `this_year`, `custom`).
2. **Tours & Excursions**: Complete CRUD for tour parameters, itineraries, highlights, FAQs, inclusions, and exclusions with direct Media Library integration.
3. **Destinations**: Regional management for Hurghada, El Gouna, Makadi Bay, Sahl Hasheesh, Safaga, and Marsa Alam.
4. **Categories**: Theme taxonomy (Island Trips, Diving, Safari, Private Yachts, Water Sports).
5. **Bookings & Reservations**: Status transitions (`pending`, `confirmed`, `cancellation_requested`, `cancelled`), hotel pickup details, and notes.
6. **Availability & Departures**: Manage daily slot caps, blackout dates, and passenger capacity counters with automatic cancellation rollbacks.
7. **Fleet Vessels**: Vessel specifications, passenger limits, safety certificates, and active/drydock statuses.
8. **Guides & Captains**: Staff directory, languages spoken, licensing, and availability assignments.
9. **Operations Assignments**: Conflict-free linking of vessels and guides to daily departures.
10. **CRM & Leads Pipeline**: Lead stage progression (`New`, `Contacted`, `Qualified`, `Proposal`, `Follow-up`, `Won`, `Lost`), task tracker, and activity timeline.
11. **Customer Directory**: Unified customer lifetime spend, booking counts, and contact notes.
12. **Reviews Moderation**: Review approval/moderation with optimistic updates and rollbacks.
13. **Coupons & Promos**: Code creation, percentage/fixed discounts, usage limits, and expiration dates.
14. **Finance & Invoicing**: Payments ledger, invoice generation with PDF printing, and refund processing.
15. **Media Library & Asset Management**: Supabase Storage integration with metadata tagging, category grouping, orphaned asset audits, and one-click tour assignment.

---

## 🛠️ Architecture & Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend Framework** | React 19, TypeScript 7.x, Vite 8.x |
| **Styling & Design** | Tailwind CSS v4, Motion (Framer Motion v12), Lucide Icons |
| **Backend & Dev Server** | Node.js, Express 4.x, TSX runtime (`server.ts`) |
| **Database & Auth** | Supabase (PostgreSQL 15+), Supabase Auth, Row-Level Security (RLS) |
| **Edge & Hosting** | Vercel (SPA rewrites, CDN edge caching) |
| **Storage & Media** | Supabase Storage (`tours` public bucket, up to 50MB) + Local Fallback Cache |
| **PWA & Offline** | Vite PWA Plugin, Service Worker, Web App Manifest |
| **AI Capabilities** | `@google/genai` (Google Gemini AI server-side proxy at `/api/chat`) |

---

## 🗄️ Database & Supabase Integration

The platform features an authoritative **54-table relational database**:
- Canonical master script: `/complete_schema.sql` (single-run provisioning).
- Full Row-Level Security (RLS) enforcing least privilege across all entities.
- Role-Based Access Control (`admin`, `super_admin`, `manager`, `staff`, `customer`).
- Server-side abuse prevention with atomic rate limiting (`check_atomic_rate_limit`) and honeypot bot suppression.

---

## 💻 Getting Started & Local Development

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** or **bun**
- (Optional) A [Supabase](https://supabase.com) account for persistent cloud data

### Installation
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Provide your Supabase URL and Anon Key in `.env` (or configure them directly via the in-app Admin Settings panel).

3. Start the development server:
   ```bash
   npm run dev
   ```
   The application will boot on `http://localhost:3000`.

---

## 🔐 Environment Variables

| Variable | Required | Description | Scope |
|---|---|---|---|
| `VITE_SUPABASE_URL` | **Yes** | Supabase project URL (`https://<project-id>.supabase.co`) | Client & Server |
| `VITE_SUPABASE_ANON_KEY` | **Yes** | Public anonymous key for database & auth with RLS | Client & Server |
| `GEMINI_API_KEY` | Optional | Google Gemini API key for AI chat concierge | Server-side only |
| `APP_URL` | **Yes** | Canonical deployment web URL | Server & Client |

---

## 🧪 Automated Testing & Verification

The project includes **13 comprehensive test suites** with **311+ automated assertions** verifying safety, security, routing, password recovery, communication provider credentials, data layer persistence, dynamic experiences, operations workflows, and financial processing:

```bash
# Run all 13 test suites in sequence
npm run test:all
```

### Individual Test Suites:
1. `npm run test:catalogue` — Catalogue dry-run verification (0 writes, 365 relational records, RFC-4122 UUIDs)
2. `npm run test:parity` — Schema parity & anti-divergence audit (55 tables, 15 functions)
3. `npm run test:security` — Admin RBAC & privilege escalation defense
4. `npm run test:abuse` — Honeypot bot traps & atomic rate limiters
5. `npm run test:routes` — Vercel SPA routing & built asset verification
6. `npm run test:admin` — Admin CRUD persistence, honest empty states, and RLS error surfacing
7. `npm run test:recovery` — Password recovery & Supabase session validation
8. `npm run test:comm` — Communication provider credentials strict validation & rejection
9. `npm run test:experiences-destinations` — Dynamic category and destination filtering logic
10. `npm run test:audit-6-2` — Phase 6.2 dynamic data flow and fallback audit
11. `npm run test:staging-6-3` — Phase 6.3 staging environment and mock-fallbacks audit
12. `npm run test:admin-ops-7` — Phase 7 operations, departures, fleet, and staff assignments
13. `npm run test:phase-8` — Phase 8 financial accounting, invoicing, coupons, and ledger reconciliation

### Lint & Build Checks:
```bash
# TypeScript verification (0 errors)
npm run lint

# Production bundle compilation
npm run build
```

---

## 🚀 Production Build & Deployment

To deploy on Vercel:
1. Connect your repository to Vercel.
2. Build Command: `npm run build`
3. Output Directory: `dist`
4. Add environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `APP_URL`, `GEMINI_API_KEY`.
5. Deploy.

For complete custom domain, DNS, and SMTP email setup instructions, see [**manual.md**](./manual.md).

---

## 📄 License
This project is open-source under the [MIT License](LICENSE). Built for high-volume tour operators and adventure travel agencies.
