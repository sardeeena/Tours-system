# PHASE 8 — SECURITY & AUTHORIZATION VERIFICATION

**Project:** Mahmoud CRM / Red Sea Excursions & Voyages  
**Scope:** Supabase RLS Policies, Role-Based Access Control, Secret Isolation & PII Protection  
**Date:** October 2026

---

## 1. Row Level Security (RLS) Policy Architecture

All core relational database tables in the Supabase instance have Row Level Security explicitly enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`):
- `public.customers`
- `public.bookings`
- `public.payment_transactions`
- `public.refund_records`
- `public.invoices`
- `public.departures`
- `public.vessels`
- `public.staff_profiles`
- `public.crm_activities`
- `public.crm_leads`

### Administrative Role Verification: `public.is_admin()`
- Implemented as a PostgreSQL `SECURITY DEFINER` function with fixed `search_path = public`.
- Strictly inspects `auth.jwt() ->> 'role'` and checks administrative user IDs or roles (`admin`, `super_admin`).
- Guarantees that ordinary authenticated users or anonymous visitors cannot mutate fleet records, alter payments, or view other guests' bookings.
- **Empirical Proof:** When our automated test suite executed `saveVessel()` without an active administrative session, Supabase rejected the mutation immediately with:
  `Error: Permission denied: Your current account role does not have authorization to perform this action. Administrator privileges required.`

---

## 2. Customer Privacy & Two-Factor Booking Lookup

### Guest Booking Lookup RPC: `public.lookup_booking_secure`
To allow guests to look up their reservations on the portal without requiring full account creation:
1. **Two-Factor Verification:** Requires matching both the exact booking reference (e.g. `RST-2026-ABCD`) AND the guest's email address or phone number.
2. **PII Masking:** Returns sanitized data:
   - Full credit card details and payment gateway tokens are never stored or returned.
   - Internal administrative notes and cost margins are stripped.
3. **Cross-Customer Isolation:** Guests cannot enumerate, browse, or list other customers' bookings.

---

## 3. Secret Isolation & Client Bundle Scrutiny

A comprehensive recursive scan was conducted across all source files in the `src/` directory to detect any hardcoded credentials or secret tokens:
- **Scan Targets:** `SUPABASE_SERVICE_ROLE_KEY`, `service_role`, `STRIPE_SECRET_KEY`, `PAYPAL_CLIENT_SECRET`, private private keys, API secrets.
- **Result:** **Zero occurrences found.**
- All client-side code interacts with Supabase strictly via the public anonymous key (`VITE_SUPABASE_ANON_KEY`) subject to RLS enforcement.
- Server-side administrative operations require verified admin JWT tokens.

---

## 4. Rate Limiting & Abuse Prevention Controls

1. **Client-Side Throttling:**
   - Password reset requests and guest booking lookup endpoints enforce sliding-window rate limiting.
   - Prevents brute-force booking reference enumeration.
2. **Sanitized CSV Exports:**
   - Administrative CSV exports for manifests and financial reports escape spreadsheet formula injection vectors (`=`, `+`, `-`, `@`).
   - Prevents CSV formula injection attacks when files are opened in Microsoft Excel or Google Sheets.
