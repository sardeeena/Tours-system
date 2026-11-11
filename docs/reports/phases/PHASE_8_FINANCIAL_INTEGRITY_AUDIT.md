# PHASE 8 — FINANCIAL INTEGRITY AUDIT

**Project:** Mahmoud CRM / Red Sea Excursions & Voyages  
**Scope:** Financial State Machine, Payment Persistence, Idempotency, Refunds & Multi-Currency Rules  
**Date:** October 2026

---

## 1. Authoritative Payment State Machine

The financial subsystem supports five explicit, non-overlapping payment states:
- `pending`: Booking received; payment outstanding.
- `partially_paid`: Initial deposit or partial payment received; outstanding balance remains.
- `paid`: Full package price received (net paid amount equals or exceeds total booking cost).
- `refunded`: Entire paid amount returned to guest via approved financial adjustment.
- `failed`: Payment attempt was rejected or aborted.

### State Transition Matrix

| Current State | Permitted Transitions | Triggering Event | Validation Rules Enforced |
|---|---|---|---|
| `pending` | `partially_paid`, `paid`, `failed` | Payment received (Cash, POS, Wire, Card) | Amount > 0; Unique transaction reference; Provider connected or marked manual. |
| `partially_paid` | `paid`, `refunded` | Additional payment or deposit refund | Balance updated. If net paid >= total, transitions to `paid`. |
| `paid` | `partially_paid`, `refunded` | Approved refund request | Total refunds cannot exceed total paid. Full refund marks booking `refunded`. |
| `refunded` | *(Terminal)* | Finalized refund | No additional refunds permitted; balance is zero. |
| `failed` | `pending` | Retried payment | Prior failed transaction preserved in audit log; new transaction reference required. |

---

## 2. Idempotency & Duplicate Prevention Controls

In `src/services/financeService.ts`, financial operations implement strict duplicate prevention:
1. **Transaction Reference Uniqueness:**
   - Every payment recorded via `recordPayment()` checks existing transaction references across database and local caches.
   - If an incoming payment carries a `transactionReference` that already exists (e.g. `TXN-AUDIT-12345`), the operation immediately rejects with:
     `Duplicate transaction reference: Transaction "..." has already been recorded.`
2. **Rejection of Non-Positive Payments:**
   - Attempts to record `amount <= 0` are immediately rejected with:
     `Payment amount must be greater than zero.`
3. **Audit Trail & Actor Attribution:**
   - Each payment record includes `recordedBy`, `paymentDate`, `notes`, and writes an immutable event into `crm_activities` and the automation event bus (`payment.received`).

---

## 3. Refund Integrity & Balance Bounds

Refund processing enforces a two-step multi-tier accounting workflow:
1. **Step 1: Request Refund (`requestRefund`)**
   - Initiated by staff with reason, amount, and method.
   - **Committed Refund Boundary:** The system sums all active refunds (`processed`, `approved`, and `pending_approval`).
   - The available refundable balance is strictly:
     $$\text{Max Available} = \max(0, \text{Total Paid} - \text{Total Committed})$$
   - Any request exceeding this balance is rejected with:
     `Cannot request €X. Maximum refundable balance is €Y (€Z paid minus €W committed/processed refunds).`
   - **Duplicate Pending Request Detection:** If an identical refund request is already in `pending_approval` state for the same booking, amount, and reason, subsequent submissions are blocked with an explicit collision error.
2. **Step 2: Approve Refund (`approveRefund`)**
   - Must be approved by authorized finance management (`Finance Manager` or `Admin`).
   - Approved amount cannot exceed the requested amount or remaining balance.
3. **Step 3: Process Refund (`processRefund`)**
   - Generates attributable transaction reference `REF-XXXXXXXX`.
   - Emits `refund.processed` event and logs activity in `crm_activities`.
   - Distinction: Internal manual accounting refunds (e.g., cash refund at pier) are clearly marked with `refundMethod: 'cash'` vs gateway reversals.

---

## 4. Multi-Currency Accounting & Mathematical Formulas

### Base Currency Standard
- **The authoritative base currency is EUR (€).**
- All database records for tour prices, subtotals, extras, pickup fees, and invoices are calculated in EUR to ensure zero floating-point drift or cross-currency pollution.
- Currencies supported for display and collection:
  - **EUR (€)**: Base currency ($1.000000$)
  - **USD ($)**: Fixed or updated exchange rate (default $1.08$)
  - **GBP (£)**: Fixed or updated exchange rate (default $0.85$)
  - **EGP (EGP)**: Fixed or updated exchange rate (default $52.50$)

### Authoritative Pricing Formulas
$$\text{Adult Subtotal} = \text{Adults} \times \text{Base Price Per Adult}$$
$$\text{Child Subtotal} = \text{Children} \times \text{Child Price Per Child (or } 50\% \text{ of Adult Price)}$$
$$\text{Infant Subtotal} = 0 \text{ EUR (Infants free)}$$
$$\text{Paying Passengers} = \text{Adults} + \text{Children}$$
$$\text{Pickup Fee} = (\text{Paying Passengers} \times \text{Fee Per Person}) + \text{Flat Fee}$$
$$\text{Extras} = \sum (\text{Qty} \times \text{Price}_{\text{per\_booking}}) + \sum (\text{Qty} \times \text{Paying Passengers} \times \text{Price}_{\text{per\_person}})$$
$$\text{Subtotal} = \text{Adult Subtotal} + \text{Child Subtotal} + \text{Pickup Fee} + \text{Extras}$$
$$\text{Net Total} = \max(0, \text{Subtotal} - \min(\text{Discount}, \text{Subtotal}))$$

### Rounding Discipline
- EUR, USD, GBP rounded to 2 decimal places (`toFixed(2)`).
- EGP rounded to whole integers (`Math.round()`) to match Egyptian commercial banking conventions.
- Zero negative balance protection: Discounts or adjustments cannot reduce the total below zero.
