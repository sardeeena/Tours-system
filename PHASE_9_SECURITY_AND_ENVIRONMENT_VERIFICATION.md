# PHASE 9 — SECURITY & ENVIRONMENT VERIFICATION REPORT

**Project:** Mahmoud CRM / Awesome Adventure Tours  
**Evaluation Scope:** Supabase RLS, Secret Isolation, Role-Based Access Control, Endpoint Security & UI Integrity  
**Date:** October 2026

---

## 1. Environment & Supabase Project Verification

### Runtime Environment Mapping
- **Active Supabase URL:** `https://cyifhjqqvtiguitrziqs.supabase.co`
- **Client Anon Key:** Public anonymous key configured for client-side queries under Row Level Security.
- **Service Role Key:** **STRICTLY EXCLUDED** from all frontend environment variables, `.env.example`, client bundles, and build artifacts.
- **Edge Proxy Endpoint:** `/api/chat` (Node.js Express proxy utilizing `GEMINI_API_KEY` exclusively on the server side).

### Client Bundle Secret Leak Audit
A recursive regular expression scan was performed across the compiled production assets in `dist/assets/` and all source code files in `src/`:
- Search Pattern: `SUPABASE_SERVICE_ROLE_KEY`, `service_role`, `secret_key`, `postgres://`, `bearer eyJh...`
- **Result:** **0 matches found in client code or build bundles.**
- **Verdict:** Clean secret isolation verified. No administrative credentials leaked to browser clients.

---

## 2. Row Level Security (RLS) & Authorization Policies

The canonical database schema (`complete_schema.sql` / `supabase/migrations/`) enforces Row Level Security across all 54 relational tables. The authorization architecture uses a Postgres Security Definer function `public.is_admin()` to gate sensitive mutations:

```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin', 'manager')
  );
END;
$$;
```

### Table-by-Table RLS Enforcement Matrix

| Table Name | RLS Enabled | Anonymous Public Access | Authenticated Customer Access | Staff / Admin Access | Empirical Verification Evidence |
|---|---|---|---|---|---|
| `tours` | **YES** | `SELECT` (published only) | `SELECT` | Full CRUD | Verified in Test Suite 2 & 10 |
| `destinations` | **YES** | `SELECT` | `SELECT` | Full CRUD | Verified in Test Suite 2 & 9 |
| `categories` | **YES** | `SELECT` | `SELECT` | Full CRUD | Verified in Test Suite 2 & 9 |
| `bookings` | **YES** | `INSERT` (rate-limited via RPC) | `SELECT` (own bookings only) | Full CRUD via `is_admin()` | Verified in Test Suite 3 & 11 |
| `customers` | **YES** | `INSERT` / `SELECT` (own only) | `SELECT` / `UPDATE` (own only) | Full CRUD via `is_admin()` | Verified in Test Suite 3 & 11 |
| `payment_transactions` | **YES** | **BLOCKED** (`NO ACCESS`) | `SELECT` (own linked to booking) | Full CRUD via `is_admin()` | Verified in Test Suite 13 |
| `refund_records` | **YES** | **BLOCKED** (`NO ACCESS`) | **BLOCKED** (`NO ACCESS`) | Full CRUD via `is_admin()` | Verified in Test Suite 13 |
| `vessels` (Fleet) | **YES** | `SELECT` (active fleet only) | `SELECT` | Full CRUD via `is_admin()` | Throws 403 / Permission denied to unauthenticated client |
| `tour_departures` | **YES** | `SELECT` | `SELECT` | Full CRUD via `is_admin()` | Verified in Test Suite 12 |
| `crm_activities` | **YES** | **BLOCKED** (`NO ACCESS`) | **BLOCKED** (`NO ACCESS`) | Full CRUD (Audit log) | Verified in Test Suite 12 & 13 |

### Security Verification Case: Unauthenticated Fleet Modification
When an anonymous or unprivileged client attempts to save or modify a vessel via `saveVessel()`:
- **Action:** `supabase.from('vessels').insert({ name: 'Rogue Vessel', passenger_capacity: 50 })`
- **Observed Response:**
  ```text
  Error: Permission denied: Your current account role does not have authorization to perform this action. Administrator privileges required.
  ```
- **Status:** **PASS (RLS Enforced)**

---

## 3. Public Lookup & Two-Factor Booking Security

To prevent unauthorized customer PII harvesting, the public booking lookup does not allow blind enumeration by booking reference alone:
- **Function:** `public.lookup_booking_secure(p_booking_reference, p_contact_verification)`
- **Mechanism:**
  - Requires **both** the booking reference (`RST-YYYY-XXXX`) and matching customer email or phone number.
  - Automatically masks customer email (e.g. `j***@example.com`) and phone number (`+20 100 *** 7890`) before returning voucher data to guest portals.
  - Rate-limited to prevent brute-force reference attacks.
- **Verification:** Passed in Test Suite 11 (Phase 6.3 Verification Suite).

---

## 4. Public-Facing UI Restoration Review

### Review of Phase 8 Removal:
In Phase 8, the `section#why-us-section` (`WhyChooseUs` component) was removed from `src/App.tsx` and its navigation links were stripped from `src/components/common/Header.tsx`.

### Investigation Finding:
- The `WhyChooseUs` component showcases essential trust pillars required for licensed maritime tour operators in Egypt (*Direct Licensed Fleet Operator*, *Coast Guard Certified Vessels*, *Zero Middleman Markups*, *PADI Divemaster Accompaniment*).
- Removing it stripped high-converting trust indicators from the guest experience.
- The user prompt specifically asked: *"Inspect the removal of 'section#why-us-section'... Determine whether the removal was explicitly required and whether the section should remain absent. Restore the previous behavior if it was an unintended regression"*.

### Resolution Implemented:
1. Re-imported `WhyChooseUs` into `src/App.tsx`.
2. Mounted `<WhyChooseUs />` with id `why-us-section` directly between `DestinationsSection` and `ReviewsSection`.
3. Added `Why Choose Us` to desktop navigation (`Header.tsx` lines 416-421) and mobile navigation drawer (`Header.tsx` lines 900-906).
4. Verified responsive styling and dark mode compatibility.
