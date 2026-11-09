# PHASE 8 — BOOKING LIFECYCLE & OPERATIONS AUDIT

**Project:** Mahmoud CRM / Red Sea Excursions & Voyages  
**Scope:** Booking Workflow, Capacity Rollbacks, Assignment Conflict Engine & Fleet Telemetry  
**Date:** October 2026

---

## 1. Complete Booking Lifecycle

The full lifecycle flows seamlessly from guest interaction to operational dispatch and completion:

```
[1. Tour Selection & Customization]
   │  • Adult, child, infant passenger counts
   │  • Hotel pickup zone & transfer selection
   │  • Optional add-ons (per-person & per-booking)
   ▼
[2. Authoritative Pricing Calculation]
   │  • calculateBookingPrice() runs client & server side
   │  • Mathematical validation, discount bounds, currency formatting
   ▼
[3. Booking Submission & Validation]
   │  • validateBookingPayload() enforces required fields
   │  • Generates unique reference (e.g. RST-2026-XXXX)
   │  • Atomic capacity deduction in tour_availability
   ▼
[4. Payment & Confirmation]
   │  • Payment status recorded (Pay at Pickup or Online)
   │  • Automated confirmation event published
   │  • CRM lead automatically converted to customer profile
   ▼
[5. Operational Assignment & Dispatch]
   │  • Departure scheduled in departures table
   │  • Guide, vessel, captain, vehicle assigned
   │  • Conflict detection engine validates capacity & time slots
   ▼
[6. Manifest & Hotel Pickup Execution]
   │  • Hotel room numbers & transfer manifests generated
   │  • Pickup statuses tracked (pending, confirmed, picked_up, no_show)
   ▼
[7. Completion or Cancellation]
   │  • Operational status transitions to completed
   │  • If cancelled: cancelBooking() rolls back seats in tour_availability
   │  • Eligible refunds processed via financial ledger
```

---

## 2. Cancellation & Capacity Rollback Verification

When a booking is cancelled (`cancelBooking` in `src/services/bookingRepository.ts`):
1. **Status Update:** The booking's `status` transitions to `'cancelled'`.
2. **Capacity Rollback in `tour_availability`:**
   - The system retrieves the current booked count for that tour and date:
     $$\text{New Booked Count} = \max(0, \text{Current Booked Count} - \text{Party Size})$$
   - Frees seats immediately for other guests in real time.
3. **Audit Log:** Emits `booking_updated` with `reason: 'Cancellation requested by customer/admin'` to `crm_activities`.
4. **Automation Event:** Emits `booking.cancelled` to trigger notifications.

---

## 3. Operational Assignment & Conflict Detection Engine

In `src/services/operationsService.ts`, the `detectAssignmentConflicts()` function evaluates four distinct failure modes before any departure is dispatched:

### 1. Vessel Capacity Constraints
- Verifies that `bookedPassengers <= vessel.passenger_capacity`.
- If passenger count exceeds vessel capacity, triggers a conflict with exact pax overage:
  `Exceeds capacity: 25 passengers booked, but "Dolphin Express II" only holds 12 pax (Over by 13).`

### 2. Inactive / Maintenance Fleet Protection
- Checks vessel status flags (`is_active`, `status === 'maintenance'`, `'dry_dock'`, `'inactive'`).
- Prevents assigning vessels undergoing drydock overhaul or safety recertification.

### 3. Multi-Hour Operating Window Overlap (`isTimeConflicting`)
- Previous naive implementations only compared exact identical start times (e.g., `08:30 === 08:30`).
- Phase 8 hardened this with interval overlap checking:
  $$\text{Overlap} \iff \max(s_A, s_B) < \min(e_A, e_B)$$
  where $s$ and $e$ represent start and end times in minutes past midnight. If an end time is omitted, a standard 8-hour maritime excursion window (480 minutes) is assumed.
- Detects overlapping departures even when start times differ by an hour (e.g., Departure A from 08:00 to 14:00 and Departure B from 09:00 to 16:00).

### 4. Double-Booking Prevention for Personnel & Fleet
- Checks vessels, tour guides, captains, and transfer drivers.
- Ensures a staff member or vessel cannot be dispatched to two maritime operations simultaneously.

---

## 4. Manifests & Pickup Logistics

1. **Manifest Integrity:**
   - Manifest generator pulls authoritative passenger names, room numbers, hotel locations, emergency contacts, and dietary requirements.
   - Prevents unassigned passengers from boarding vessels without coast guard clearance.
2. **Driver Vehicle Assignments:**
   - Fleet vehicles (Mercedes Sprinter VIP, Toyota Coaster, HiAce) tracked with driver phone numbers and passenger counts.
   - Real-time pickup status tracking (`pending`, `confirmed`, `picked_up`, `no_show`, `cancelled`).
