# Phase 7: Manual Acceptance Test Procedures

**Project:** Mahmoud CRM / Red Sea Excursions & Voyages  
**Date:** October 2026  
**Audience:** QA Engineers, Operations Managers, Dispatchers, and Finance Auditors  

---

## 1. Test Overview

This document provides step-by-step procedures to manually verify that administrative operations, field assignments, financial transactions, and report generation execute properly in staging or production environments.

---

## 2. Test Scenarios

### Test 1: Dynamic Tour Creation to Operations Departure Dispatch
- **Objective:** Verify that a newly published tour immediately appears in Operations departure scheduling.
- **Pre-Conditions:** Admin user logged in with `admin` or `manager` role.
- **Steps:**
  1. Navigate to `/admin` -> **Tours & Excursions** tab.
  2. Click **"Add New Tour"** and enter:
     - Title: `Utopia Island VIP Catamaran Cruise`
     - Price: `€75`
     - Duration: `7 Hours`
     - Destination: `Safaga & Soma Bay`
     - Category: `Sea Trips`
     - Status: `Published`
  3. Click **"Save Tour"**. Verify success toast appears and tour is listed.
  4. Navigate to **Operations** -> **Departures** tab.
  5. Click **"Schedule New Departure"**.
  6. Open the **"Tour Excursion"** dropdown.
- **Expected Result:**
  - `Utopia Island VIP Catamaran Cruise` is selectable in the dropdown list.
  - Submitting the departure creates a scheduled departure record without schema or foreign-key errors.

---

### Test 2: Fleet Assignment & Real-Time Conflict Detection
- **Objective:** Verify that assigning the same vessel or captain to overlapping departures triggers an assignment conflict warning.
- **Steps:**
  1. In **Operations** -> **Assignments**, select tomorrow's date.
  2. Click **"New Resource Assignment"**:
     - Tour: `Giftun Island Snorkeling Trip`
     - Time: `08:30`
     - Vessel: `M/Y Red Sea Star VIP (Capacity: 45)`
     - Captain: `Captain Tarek`
  3. Click **"Save Assignment"**.
  4. Attempt to create a second assignment for the same date and time (`08:30`):
     - Tour: `Dolphin House VIP Cruise`
     - Vessel: `M/Y Red Sea Star VIP`
- **Expected Result:**
  - Real-time pre-save validation triggers an `AssignmentConflict` alert: *"Vessel M/Y Red Sea Star VIP is already scheduled on Giftun Island at 08:30"*.
  - System blocks double-booking or displays a high-visibility warning to the dispatcher.

---

### Test 3: Reservation Lifecycle & Direct Payment Mutation
- **Objective:** Verify that changing booking and payment statuses in `AdminBookingsList` updates Supabase and CRM timelines.
- **Steps:**
  1. Navigate to `/admin` -> **Bookings & Reservations**.
  2. Click **"Inspect"** on any confirmed reservation with pending payment.
  3. Under **"Payment Status"**, click **"Mark Paid"**.
  4. Confirm that the toast states *"Payment status updated to PAID"*.
  5. Close the inspection modal and verify the reservation row displays the green `PAID` badge.
  6. Navigate to **CRM** -> **Activity Timeline**.
- **Expected Result:**
  - A new timeline entry appears: *"Booking Updated: RST-XXXX - Payment status: paid"*.
  - In **Finance** -> **Outstanding Balances**, the balance for this reservation drops to `€0.00`.

---

### Test 4: Passenger Manifest & Dispatch Sheet Generation
- **Objective:** Verify that passenger manifests include lead and accompanying guests and format correctly for maritime inspection.
- **Steps:**
  1. Navigate to **Operations** -> **Passenger Manifest**.
  2. Select today's date and filter by any tour with active bookings.
  3. Verify all party members appear (Lead Passenger with phone and hotel; Guest 2, Guest 3 with designated party labels).
  4. Click **"Print Manifest"** and **"Export CSV"**.
- **Expected Result:**
  - The printed document includes official company maritime header, registration numbers, emergency contacts, and guest manifest.
  - Exported CSV includes clean UTF-8 headers with no `undefined` or corrupted characters.

---

### Test 5: Controlled Refund Net Balance Limit Enforcement
- **Objective:** Ensure refunds cannot exceed actual net collected payments.
- **Steps:**
  1. Navigate to **Finance** -> **Refunds**.
  2. Click **"Request Refund"**.
  3. Select a booking that has a total paid amount of `€100.00`.
  4. Enter a requested refund amount of `€150.00`.
  5. Click **"Submit Refund Request"**.
- **Expected Result:**
  - The request is rejected with a clear error: *"Cannot request €150. Maximum refundable balance is €100 (€100 paid minus €0 processed refunds)"*.
  - Database state remains unchanged.

---

### Test 6: Custom Report Builder Multi-Dimensional Query
- **Objective:** Verify that the custom report builder properly aggregates dynamic tours, destinations, and dates.
- **Steps:**
  1. Navigate to **Reports & Analytics** -> **Report Builder**.
  2. Set Date Range to `Current Month`.
  3. Filter by **Destination Market**: `Hurghada`.
  4. Filter by **Payment Status**: `Paid`.
  5. Click **"Export CSV"**.
- **Expected Result:**
  - The summary KPI cards update immediately to reflect the count, gross revenue, guest count, and collection percentage.
  - CSV file downloads instantly with sanitized quoting and UTF-8 BOM encoding.
