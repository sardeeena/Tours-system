# SECURITY AUDIT AND RELEASE GATE REPORT
**Project**: Awesome Adventure Tours / Mahmoud CRM Platform  
**Target Domain**: `https://awesomeadventure.tours`  
**Authoritative Supabase Project**: `cyifhjqqvtiguitrziqs` (`https://cyifhjqqvtiguitrziqs.supabase.co`)  
**Target Hosting Runtime**: Hostinger Business Web Hosting (Node.js 20+ / 22+ LTS)  
**Status**: Phase 11B Targeted Corrections Completed (Awaiting Human DBA Review for Live Execution)  
**Date**: October 2026  
**Auditor**: Lead Security & Infrastructure Systems Engineer  

---

## 1. Architectural Summary & Scope

This report consolidates the security audit, authorization boundaries, cryptographic key validation, and Hostinger production deployment readiness for the Awesome Adventure Tours platform.

### Core Architecture Pillars:
1. **Frontend**: React 19 Single Page Application built with Vite 8.x, Tailwind CSS v4, Motion, Lucide icons, and PWA service worker with Workbox offline caching.
2. **Backend Gateway**: Node.js Express server (`server.ts` compiled via esbuild to `server.js`) serving static assets from `dist/`, handling `/api/*` routes, same-origin database query gateway, and SPA fallback routing.
3. **Database & Auth**: Authoritative Supabase PostgreSQL 15+ database (`cyifhjqqvtiguitrziqs`) with 54 normalized tables, Row Level Security (RLS) on all tables, and Postgres `is_admin()` Security Definer authorization checks.

---

## 2. Key Format Validation & Isolation Architecture

In alignment with current official Supabase security specifications:

### Key Classifications:
1. **Modern Secret Keys (`sb_secret_...`)**:
   - Used exclusively on the server backend (`SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY`).
   - CLI personal access tokens (`sbp_...`) are not valid project secret keys and are strictly rejected.
   - Strictly prohibited in frontend bundles, browser storage, or client environment variables.
2. **Modern Publishable Keys (`sb_publishable_...`)**:
   - Client-safe public key (`VITE_SUPABASE_ANON_KEY`).
   - Never accepted by the server as a secret or service-role credential.
3. **Legacy Service-Role JWTs (`role === 'service_role'`)**:
   - Server-only, strictly validated.
4. **Legacy Anon JWTs (`role === 'anon'`)**:
   - Public client token, strictly validated.

### Fail-Closed Safeguards:
- **No Silent Fallback**: The server does NOT silently fall back to any hardcoded production database URL when configured credentials are missing or invalid. Protected operations fail closed with HTTP 503 (`Database service is currently unconfigured or unavailable`).
- **No Credential Mixing**: Supplying a publishable or anonymous key to `SUPABASE_SERVICE_ROLE_KEY` is explicitly detected and rejected with a fatal configuration warning.
- **Browser Storage Protection**: `src/services/supabaseClient.ts` inspects keys entered in browser storage; if any secret or service-role key is detected, it is immediately purged from `localStorage`.

---

## 3. Row Level Security (RLS) & Access Control Matrix

All operational database tables enforce Row Level Security:

| Table Name | RLS Enabled | Anon Read | Authenticated Customer Read | Staff / Admin Access | RLS Defense Notes |
|---|---|---|---|---|---|
| `tours` | **YES** | `SELECT` (published only) | `SELECT` | Full CRUD | Filtered by `is_published = true` for public |
| `destinations` | **YES** | `SELECT` | `SELECT` | Full CRUD | Public catalog viewing |
| `categories` | **YES** | `SELECT` | `SELECT` | Full CRUD | Public activity category viewing |
| `bookings` | **YES** | **BLOCKED** (Direct SELECT) | `SELECT` (own bookings only: `auth.uid() = user_id`) | Full CRUD via `is_admin()` | Anonymous lookups use two-factor `lookup_booking_secure` RPC |
| `customers` | **YES** | **BLOCKED** | `SELECT` / `UPDATE` (own record only) | Full CRUD via `is_admin()` | Strict PII protection |
| `payment_transactions` | **YES** | **BLOCKED** | `SELECT` (own linked booking) | Full CRUD via `is_admin()` | Write access blocked from client |
| `refund_records` | **YES** | **BLOCKED** | **BLOCKED** | Full CRUD via `is_admin()` | Admin only ledger |
| `vessels` (Fleet) | **YES** | `SELECT` (active fleet only) | `SELECT` | Full CRUD via `is_admin()` | Non-admin insert/update rejected with 403 |
| `departures` | **YES** | `SELECT` | `SELECT` | Full CRUD via `is_admin()` | Scheduling and dispatch records |
| `profiles` | **YES** | `SELECT` (own profile) | `SELECT` / `UPDATE` (own profile) | Full CRUD via `is_admin()` | Self-escalation blocked by trigger `trigger_protect_profile_role` |
| `crm_activities` | **YES** | **BLOCKED** | **BLOCKED** | Full CRUD via `is_admin()` | Internal audit and communication log |

---

## 4. Backend Gateway Security (`/api/db/query`)

The backend gateway endpoint `/api/db/query` enforces:
1. **Structural Security Boundary**: Does NOT rely on SQL keyword parsing. Rejects any request payload containing `table`, `tables`, `columns`, `fields`, `filters`, `filter`, `where`, `sql`, `rawSql`, `query`, or `action` with HTTP 400.
2. **Fixed Query Logic**: Only explicitly defined business operations are permitted:
   - `get_tours`: sanitized search, category, destination filters; fixed column projections.
   - `get_destinations`: fixed order and allowlisted columns.
   - `get_categories`: fixed order and allowlisted columns.
   - `get_my_bookings`: requires cryptographically validated JWT session; strictly scoped to `req.user.id`.
   - `lookup_booking`: strict format validation (`^RST-\d{4}-[A-Z0-9]+$`), rate-limited, returns masked PII.
   - `get_admin_overview`: requires verified staff/admin role from `public.profiles`.
3. **Zero Arbitrary Writes**: Unrestricted table writes are completely blocked through the gateway.
4. **Information Leakage Prevention**: Never leaks raw database error objects, connection strings, or internal stack traces to the client.

---

## 5. Guest Booking Lookup & PII Protection

1. **Two-Factor Verification**: Lookups require booking reference plus customer contact verification (email or phone).
2. **RPC Integration**: Calls `public.lookup_booking_secure(p_reference, p_verification)`. Handles direct JSONB return with masked email (`jo***@domain.com`) and phone (`***-***-1234`).
3. **Anti-Enumeration Rate Limiting**: `/api/bookings/lookup` is rate-limited to 10 requests per minute per IP to prevent brute-force voucher enumeration.
4. **No Session Escalation**: Guest voucher lookup never creates or returns an authenticated session JWT.

---

## 6. Storage Access Security

1. **Folder Whitelist**:
   - Only allowlisted directories are permitted: `tours`, `destinations`, `vessels`, `guides`, `reviews`, `blog`.
   - `sanitizeStorageFolder()` strictly enforces this whitelist and strips traversal sequences (`..`).
2. **File Deletion Authorization**:
   - `cleanOrphanedStorageFiles()` requires an authenticated caller with verified `admin` or `super_admin` role.
   - Purge paths are validated to ensure they belong to allowed directories.
3. **File Size & MIME Guards**:
   - Image maximum: 10 MB (JPG, PNG, WebP, AVIF).
   - Video maximum: 50 MB (MP4, WebM).

---

## 7. Hostinger Node.js Deployment Specifications

1. **Runtime Target**: Node.js 20.x or 22.x LTS (`engines: { "node": ">=20.0.0 <23.0.0" }`).
2. **Entry File**: `server.js` (compiled from `server.ts` via `esbuild`).
3. **Environment Configuration**:
   - **Section A (Private Server Variables — Hostinger Application Manager)**:
     - `PORT=3000`
     - `NODE_ENV=production`
     - `SUPABASE_URL=https://cyifhjqqvtiguitrziqs.supabase.co`
     - `SUPABASE_SERVICE_ROLE_KEY=<private_secret_key>`
     - `GEMINI_API_KEY=<private_gemini_key>`
   - **Section B (Public Client Variables — Build Time)**:
     - `VITE_SUPABASE_URL=https://cyifhjqqvtiguitrziqs.supabase.co`
     - `VITE_SUPABASE_ANON_KEY=<public_anon_publishable_key>`
4. **SPA Routing**: Non-API routes are served from `dist/index.html`. `/api/*` routes return structured JSON and are never intercepted by the SPA fallback.

---

## 8. Migration Review & Release Gates

1. **Migration File**: `supabase/migrations/20261027000000_phase11_production_security_hardening.sql`
   - Non-immutable `REGEXP_REPLACE` index expression replaced with standard B-tree index on `public.customers(phone)`.
   - **CRITICAL**: This migration is for HUMAN DBA REVIEW ONLY. It must NOT be run automatically or applied to the production database during automated tasks.
2. **Live Production Database**: Remained completely untouched throughout Phases 11B and 11C.
3. **Execution Limits Acknowledgment**: In strict compliance with task constraints, no test suites, full builds, compilations, scans, external API requests, database queries, migrations, or deployments were run.

---

## 9. Phase 11C Final Configuration Review Findings

1. **Supabase Key Classification**:
   - Modern secret keys are strictly `sb_secret_...` and legacy service-role JWTs (`payload.role === 'service_role'`).
   - `sbp_...` tokens are Supabase CLI personal access tokens, not valid server secrets, and were removed from secret key recognition in both `server.ts` and `src/services/supabaseClient.ts`.
   - The server enforces fail-closed behavior, returning 503 for privileged operations if an invalid key or publishable key is supplied as a server secret.
2. **ES Module Startup**:
   - `package.json` specifies `"type": "module"`, `"start": "node server.js"`, and `"build": "vite build && esbuild server.ts --bundle --platform=node --format=esm --packages=external --outfile=server.js"`.
   - The generated `server.js` uses ES module syntax (`import express from "express"`), which Node executes as ESM due to `"type": "module"`.
3. **Hostinger Port & Startup**:
   - `server.ts` defines `const PORT = process.env.PORT || 3000;` and binds via `app.listen(PORT, callback)` without hardcoded conflicting hostnames, supporting both numeric ports and Hostinger Passenger unix socket pipes.
   - `npm start` references `node server.js`.
   - The `clean` script (`rm -rf dist`) removes build artifacts without deleting `server.js`.
   - Node engine constraint `node >=20.0.0 <23.0.0` is preserved.
4. **Production Database Isolation**:
   - All server database operations fail closed when credentials are missing or invalid, preventing any silent fallback to production databases.
5. **Secret Exposure Safeguards**:
   - Public keys (`sb_publishable_...` and `anon` JWTs) are safe for browser clients under RLS.
   - Private secrets (`sb_secret_...`, `service_role` JWTs, Gemini keys, payment secrets) are isolated to the backend and never exposed to `VITE_*` variables or client bundles.
6. **Feature Preservation**:
   - All booking, customer portal, admin, finance, CRM, availability, and tour operations are preserved.
