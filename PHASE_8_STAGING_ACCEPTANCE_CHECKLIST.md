# PHASE 8 — STAGING ACCEPTANCE CHECKLIST

**Project:** Mahmoud CRM / Red Sea Excursions & Voyages  
**Target Environment:** Staging Deployment Verification  
**Date:** October 2026

This checklist defines the criteria required for sign-off prior to production promotion.

---

## 1. Automated Verification Prerequisites

| Requirement | Target Standard | Verification Method | Status |
|---|---|---|---|
| Complete Test Suite Run | 13 Suites, 311 Assertions | `npm run test:all` | **PASSED (311/311)** |
| Production Build Compilation | Zero Vite/TypeScript errors | `npm run build` | **PASSED (0 Errors)** |
| Applet Compilation Integrity | AI Studio container build | `compile_applet` | **PASSED** |
| Zero Leaked Secrets | No service-role keys in bundles | Source code scan in `src/` | **PASSED (0 Found)** |

---

## 2. Financial Controls Acceptance

| Verification Item | Acceptance Criteria | Automated Test | Staging Sign-Off |
|---|---|---|---|
| Payment Idempotency | Duplicate transaction reference rejected with clear error | Verified in Test Suite 13 | Pending Staging Test Gateway |
| Non-Positive Payment Guard | Amounts $\le 0$ rejected | Verified in Test Suite 13 | Verified in Test Suite 13 |
| Refund Balance Boundary | Cumulative refunds cannot exceed net paid amount | Verified in Test Suite 13 | Verified in Test Suite 13 |
| In-Flight Refund Subscription | Pending approval refunds count against available balance | Verified in Test Suite 13 | Verified in Test Suite 13 |
| Multi-Currency Conversion | Base EUR with explicit display rates (USD, GBP, EGP) | Verified in Test Suite 11 & 13 | Verified in Test Suite 11 & 13 |
| Real Gateway Transactions | Stripe Test Mode / PayPal Sandbox execution | N/A (Requires Test API Keys) | **Pending Live Test Credentials** |

---

## 3. Booking & Operations Lifecycle Acceptance

| Verification Item | Acceptance Criteria | Automated Test | Staging Sign-Off |
|---|---|---|---|
| Authoritative Pricing | Subtotals, discounts, pickup, extras match exact math | Verified in Test Suite 11 & 13 | Verified in Test Suite 11 & 13 |
| Capacity Rollback | Cancellation increments available seats in availability | Verified in Test Suite 13 | Verified in Test Suite 13 |
| Vessel Over-Capacity Detection | Rejects departures exceeding maximum passenger count | Verified in Test Suite 12 & 13 | Verified in Test Suite 12 & 13 |
| Time Window Overlap | Catches overlapping multi-hour tour operating windows | Verified in Test Suite 13 | Verified in Test Suite 13 |
| Inactive Fleet Detection | Rejects vessels in drydock or maintenance status | Verified in Test Suite 13 | Verified in Test Suite 13 |
| Coast Guard Manifest Export | Exports valid passenger list with hotel room numbers | Verified in Test Suite 12 | Verified in Test Suite 12 |

---

## 4. Security & Role-Based Access Control

| Verification Item | Acceptance Criteria | Automated Test | Staging Sign-Off |
|---|---|---|---|
| Supabase RLS Enforcement | Unauthorized writes rejected with 403 / permission denied | Verified in Test Suite 13 | Verified in Test Suite 13 |
| Admin Authorization Guard | Admin views and actions require `is_admin()` verification | Verified in Test Suite 3 & 13 | Verified in Test Suite 3 & 13 |
| 2FA Guest Lookup | Reference + email/phone required to view booking | Verified in Test Suite 11 | Verified in Test Suite 11 |
| CSV Injection Sanitization | Formula prefixes (`=`, `+`, `-`, `@`) escaped | Verified in Test Suite 12 | Verified in Test Suite 12 |

---

## 5. Communications & External Providers Acceptance

| Verification Item | Acceptance Criteria | Automated Test | Staging Sign-Off |
|---|---|---|---|
| Provider Honesty | Disconnected providers marked as offline; no silent fakes | Verified in Test Suite 8 | Verified in Test Suite 8 |
| Email Relay Delivery | Real staging SMTP / Resend test transactional email | N/A (Requires Test API Keys) | **Pending Live Test Credentials** |
| WhatsApp Business Delivery | Meta WhatsApp Cloud API sandbox notification | N/A (Requires Test API Keys) | **Pending Live Test Credentials** |
