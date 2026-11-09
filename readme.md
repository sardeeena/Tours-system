# 🌊 Red Sea Excursions & Voyages Platform (Mahmoud CRM)

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
2. [Documentation Guides](#-documentation-guides)
3. [Key Capabilities & Features](#-key-capabilities--features)
4. [Architecture & Tech Stack](#-architecture--tech-stack)
5. [Database & Supabase Integration](#-database--supabase-integration)
6. [Project Structure](#-project-structure)
7. [Getting Started & Local Development](#-getting-started--local-development)
8. [Environment Variables](#-environment-variables)
9. [Admin CMS, Operations, CRM & Finance](#-admin-cms-operations-crm--finance)
10. [Automated Testing & Verification](#-automated-testing--verification)
11. [Production Build & Deployment](#-production-build--deployment)
12. [License](#-license)

---

## 🌟 Project Overview

**Red Sea Excursions & Voyages** delivers a luxury direct-to-consumer maritime tourism experience alongside a comprehensive operations management engine. It connects international holidaymakers in Egypt (Hurghada, El Gouna, Sahl Hasheesh, Makadi Bay, Safaga, Marsa Alam) with verified local sea captains, desert safari guides, and PADI-certified divemasters.

The platform provides real-time excursion discovery, automated multi-step booking workflows, hotel pickup coordination, PDF voucher generation, wishlist management, interactive customer accounts, and a 15-module administration dashboard.

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
- **Cinematic Dynamic Hero**: Rotating auto-advancing showcase spanning 5 excursion categories (Island & Snorkeling, Desert Safari, PADI Scuba, Luxury Private Yachts, and Water Sports) with synchronized headlines, localized marine telemetry, and live conditions.
- **Parametric Search & Filtering**: Multi-criteria search engine filtering by destination, activity category, guest count, price tier, duration, and departure date.
- **Skeleton Shimmer Loaders**: Full-layout skeleton loaders for the home grid, excursions page, and detailed tour pages ensuring zero cumulative layout shift (CLS).
- **Tour Detail Pages**:
  - High-resolution interactive media gallery with lightbox support.
  - Granular minute-by-minute itinerary timeline.
  - Comprehensive Inclusions vs. Exclusions breakdown.
  - What to Bring & Important Maritime Regulations checklists.
  - Live verified guest reviews with star breakdown distributions.
  - Dynamic pickup add-on selector and optional upgrades (e.g. underwater GoPro rentals, seafood upgrades).

### 💳 Booking & Reservation Flow
- **Direct 3-Step Checkout Modal**:
  1. Date & party selection (adults, children, infants) with live capacity validation.
  2. Resort lobby pickup specification with optional area surcharges (El Gouna, Makadi Bay, Soma Bay).
  3. Lead passenger contact details, special requests, and payment selection (`Pay at Pickup` cash/card or online options).
- **Instant Booking Confirmation**: Generates a unique booking reference (`RST-XXXX-XXXX`) with downloadable digital voucher summaries.
- **Draft Autosave**: Automatically preserves uncompleted booking state in browser local storage so guests never lose progress.

### 👤 Customer Voyager Portal
- **Supabase Authentication**: Email/password registration, secure login, password reset flow, and auto-profile syncing via PostgreSQL triggers.
- **My Bookings Dashboard**: History of upcoming, completed, and cancellation-requested tours.
- **Live Digital Vouchers**: Direct print and voucher inspection modal with barcode generation and hotel meeting point info.
- **Wishlist & Saved Tours**: Fast off-canvas drawer to save favorite excursions with real-time counters.

### 🛡️ 15-Module Executive Admin Dashboard
1. **Executive & BI Analytics**: Real-time revenue counters, passenger counts, conversion metrics, and date-range filters (`today`, `this_week`, `this_month`, `last_month`, `this_year`, `custom`).
2. **Tours & Excursions**: Complete CRUD for tour parameters, itineraries, highlights, FAQs, inclusions, and exclusions.
3. **Destinations**: Regional management for Hurghada, El Gouna, Makadi Bay, Sahl Hasheesh, Safaga, and Marsa Alam.
4. **Categories**: Theme taxonomy (Island Trips, Diving, Safari, Private Yachts, Water Sports).
5. **Bookings & Reservations**: Status transitions (`pending`, `confirmed`, `cancellation_requested`, `cancelled`), hotel pickup details, and notes.
6. **Availability & Departures**: Manage daily slot caps, blackout dates, and passenger capacity counters with automatic cancellation rollbacks.
7. **Fleet Vessels**: Vessel specifications, passenger limits, safety certificates, and active/drydock statuses.
8. **Guides & Captains**: Staff directory, languages spoken, PADI licensing, and availability assignments.
9. **Operations Assignments**: Conflict-free linking of vessels and guides to daily departures.
10. **CRM & Leads Pipeline**: Lead stage progression (`New`, `Contacted`, `Qualified`, `Proposal`, `Follow-up`, `Won`, `Lost`), task tracker, and activity timeline.
11. **Customer Directory**: Unified customer lifetime spend, booking counts, and contact notes.
12. **Reviews Moderation**: Review approval/moderation with optimistic updates and rollbacks.
13. **Coupons & Promos**: Code creation, percentage/fixed discounts, usage limits, and expiration dates.
14. **Finance & Invoicing**: Payments ledger, invoice generation with PDF printing, and refund processing.
15. **Media Library**: Supabase Storage integration with metadata tagging and orphaned asset audit tools.

---

## 🛠️ Architecture & Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend Framework** | React 19, TypeScript 7.x, Vite 8.x |
| **Styling & Design** | Tailwind CSS v4, Motion (Framer Motion v12), Lucide Icons |
| **Backend & Dev Server** | Node.js, Express 4.x, TSX runtime (`server.ts`) |
| **Database & Auth** | Supabase (PostgreSQL 15+), Supabase Auth, Row-Level Security (RLS) |
| **Edge & Hosting** | Vercel (SPA rewrites, CDN edge caching) |
| **Storage & Media** | Supabase Storage (`tours` public bucket, up to 50MB) |
| **PWA & Offline** | Vite PWA Plugin, Service Worker, Web App Manifest |
| **AI Capabilities** | `@google/genai` (Google Gemini AI server-side proxy at `/api/chat`) |

---

## 🗄️ Database & Supabase Integration

The platform features an authoritative **54-table relational database**:
- Canonical master script: `/complete_schema.sql` (single-run provisioning).
- Full Row-Level Security (RLS) enforcing least privilege.
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

The project includes **6 comprehensive test suites** covering safety, security, routing, and data layer persistence:

```bash
# Run all 6 test suites
npm run test:all
```

Individual test suites:
- `npm run test:catalogue` — Catalogue dry-run verification (0 writes)
- `npm run test:parity` — Schema parity audit (54 tables, 13 functions)
- `npm run test:security` — Admin RBAC & privilege escalation defense
- `npm run test:abuse` — Honeypot bot traps & atomic rate limiters
- `npm run test:routes` — Vercel SPA routing & built asset verification
- `npm run test:admin` — Admin CRUD persistence, honest empty states, and type safety

TypeScript check:
```bash
npm run lint
```

Production build test:
```bash
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
This project is open-source under the [MIT License](LICENSE). Built for high-volume tour operators and maritime vacation agencies.
