# Phase 7: Complete Admin Functionality & Data-Flow Matrix

**Project:** Mahmoud CRM / Red Sea Excursions & Voyages  
**Date:** October 2026  
**Auditor:** Lead System Architect  

---

## Complete Operational Matrix Across All Admin Modules

| Admin Section | Sub-View / Tab | Component | Supabase Tables & Storage | Primary Actions Supported | Dynamic Source | Fallback Behavior | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Catalogue** | Excursions / Tours | `AdminTourList.tsx`, `TourFormModal.tsx` | `tours`, `tour_gallery_images`, storage `tour-images` | Create, Edit, Clone, Delete, Publish/Unpublish, Reorder | Live Supabase `tours` | Seed data if unconfigured | **Operational** |
| **Catalogue** | Destinations | `AdminDestinationsList.tsx` | `destinations` | Create, Edit, Delete, Toggle Featured, Change Sort | Live Supabase `destinations` | Seed data if unconfigured | **Operational** |
| **Catalogue** | Categories | `AdminCategoriesList.tsx` | `categories` | Create, Edit, Delete, Icon Selection, Change Order | Live Supabase `categories` | Seed data if unconfigured | **Operational** |
| **Catalogue** | Reviews Moderation | `AdminReviewsList.tsx` | `reviews` | Approve, Reject, Delete, Filter by Rating & Status | Live Supabase `reviews` | Empty list if unconfigured | **Operational** |
| **Catalogue** | Pickup Zones | `AdminPickupList.tsx` | `pickup_locations` | Create, Edit, Set Per-Person/Flat Fees, Set Area | Live Supabase `pickup_locations` | Seed data if unconfigured | **Operational** |
| **Catalogue** | Booking Extras | `AdminExtrasList.tsx` | `tour_extras` | Create, Edit, Pricing Basis (Person/Booking), Active Toggle | Live Supabase `tour_extras` | Seed data if unconfigured | **Operational** |
| **Bookings** | Reservations List | `AdminBookingsList.tsx` | `bookings`, `booking_passengers`, `customers` | Search, Status Change (Confirm/Complete/Cancel), Payment Status (Paid/Refund/Pending), CSV Export | Live Supabase `bookings` | Local storage fallback | **Operational** |
| **Operations**| Today's Departures| `OperationsDepartures.tsx`| `departures`, `bookings`, `vessels`, `guides` | Create Departure, Status Lifecycle (Scheduled -> Completed), View Manifest | Live Supabase + `getPublishedTours()` | Local storage fallback | **Operational** |
| **Operations**| Crew & Fleet Assign| `OperationsAssignments.tsx`| `departures`, `vessels`, `guides` | Assign Vessel/Captain/Guide/Driver, Conflict Detection | Live Supabase + `getPublishedTours()` | Local storage fallback | **Operational** |
| **Operations**| Availability Slots| `OperationsAvailability.tsx`| `tour_availability`, `bookings` | Set Max Capacity, Blackout Date, Slot Status | Live Supabase + `getPublishedTours()` | In-memory computed | **Operational** |
| **Operations**| Passenger Manifest| `OperationsManifests.tsx` | `booking_passengers`, `bookings` | Edit Passport/Nationality, Print Manifest, Export CSV | Live Supabase + `getPublishedTours()` | In-memory computed | **Operational** |
| **Operations**| Pickup Schedule | `OperationsPickups.tsx` | `pickup_schedules`, `bookings` | Driver/Vehicle Assignment, Status (Picked Up/No Show) | Live Supabase `pickup_schedules` | In-memory computed | **Operational** |
| **Operations**| Maritime Fleet | `OperationsFleet.tsx` | `vessels` (`DbVessel`) | Add Boat, Edit Capacity/Safety Expiry, Set Maintenance | Live Supabase `vessels` | In-memory seed fleet | **Operational** |
| **Operations**| Guides & Captains | `OperationsGuides.tsx` | `guides` (`DbGuide`) | Add Guide/Captain, Languages, Maritime License Expiry | Live Supabase `guides` | In-memory seed staff | **Operational** |
| **Operations**| Maritime Weather | `OperationsWeather.tsx` | Open-Meteo Marine API | Real-time Red Sea wave/wind telemetry | Live External API | Honest "Weather unavailable" | **Operational** |
| **Operations**| Dispatch Documents| `OperationsDocuments.tsx` | Derived operational data | Generate & Print Marina Manifests & Driver Pickup Sheets | Live Supabase + `getPublishedTours()` | In-memory computed | **Operational** |
| **Finance** | Payments Ledger | `FinancePayments.tsx` | `payment_transactions`, `bookings` | Record Manual Payment, View Provider, Filter Method | Live Supabase `payment_transactions` | Local storage fallback | **Operational** |
| **Finance** | Invoices Engine | `FinanceInvoices.tsx` | `invoices`, `bookings` | Generate Invoice, Print PDF, Track Due/Paid Balances | Live Supabase `invoices` | Auto-generated from bookings | **Operational** |
| **Finance** | Controlled Refunds| `FinanceRefunds.tsx` | `refund_records`, `payment_transactions` | Request Refund, 2-Step Approval, Net Balance Enforcement | Live Supabase `refund_records` | Local storage fallback | **Operational** |
| **Finance** | Outstanding Due | `FinanceBalances.tsx` | Computed from `bookings` & `payment_transactions` | Filter by Balance, Send Payment Link, Record Settlement | Live Supabase bookings & payments | In-memory computed | **Operational** |
| **Finance** | Financial Reports | `FinanceReports.tsx` | Ledger aggregation | Filter by Excursion, Destination, Method; Export CSV | Live Supabase + `getPublishedTours()` | Computed from ledger | **Operational** |
| **Finance** | Payment Gateways | `FinanceProviders.tsx` | Provider configuration | Enable/Disable CIB/Stripe/Fawry/Cash, Configure Keys | Secure system settings | Disconnected fallback | **Operational** |
| **CRM** | Unified Customers | `CRMUnifiedCustomers.tsx` | `customers`, `bookings` | Lifetime Spend, Booking Count, VIP Tagging, Export CSV | Live Supabase `customers` | Local storage fallback | **Operational** |
| **CRM** | Sales Leads | `CRMLeadsPipeline.tsx` | `crm_leads` | Kanban Pipeline (New -> Won), Drag & Drop Stage Update | Live Supabase `crm_leads` | Local storage fallback | **Operational** |
| **CRM** | Customer Inquiries| `CRMInquiries.tsx` | `inquiries`, `tours` | Status (New/Contacted/Resolved), Quick Response | Live Supabase `inquiries` | Local storage fallback | **Operational** |
| **CRM** | Activity Audit | `CRMActivityTimeline.tsx` | `crm_activities` | Immutable Staff Action Log, Filters by Actor/Event | Live Supabase `crm_activities` | Local storage fallback | **Operational** |
| **Communications**| Message Templates| `CommTemplates.tsx` | `message_templates` | Edit Email/WhatsApp Templates, Variable Placeholders | Live Supabase / default templates | Default templates | **Operational** |
| **Communications**| Dispatch Log | `CommMessageLog.tsx` | `communication_logs` | Real-time Message Log, Channel (Email/WA), Delivery Status | Live Supabase `communication_logs` | Local storage fallback | **Operational** |
| **Communications**| Direct Composer | `CommComposerModal.tsx` | Webhook / API Dispatcher | Send Ad-Hoc Email/WhatsApp with Variable Preview | Live provider dispatcher | Honest provider error | **Operational** |
| **Communications**| Staff Alerts | `StaffNotificationBell.tsx`| `rse_staff_notifications` | Unread Badge, Mark All Read, Direct Tab Navigation | Local storage + in-memory | In-memory queue | **Operational** |
| **Reporting** | Executive KPI | `ExecutiveOverview.tsx` | Aggregate Reporting Engine | Net Revenue, Margin, Conversion Rate, Top Performers | Multi-table live calculation | Live calculated | **Operational** |
| **Reporting** | Sales Analytics | `SalesAnalyticsView.tsx`| Aggregate Reporting Engine | Lead Channel Yield, Staff Win Rate, Monthly Revenue | Multi-table live calculation | Live calculated | **Operational** |
| **Reporting** | Operations KPI | `OperationsAnalyticsView.tsx`| Aggregate Operations Engine | Vessel Utilization %, Guide Hours, Daily Pax Density | Multi-table live calculation | Live calculated | **Operational** |
| **Reporting** | Customer Insights| `CustomerAnalyticsView.tsx`| Aggregate Customer Engine | Nationalities Breakdown, Hotel Distribution, Interests | Live Supabase + `getPublishedTours()` | Live calculated | **Operational** |
| **Reporting** | Report Builder | `ReportBuilderView.tsx` | Multi-Dimensional Query Engine | 8-Dimensional Filters, Summary Totals, CSV / Print PDF | Live Supabase + `getPublishedTours()` | Live calculated | **Operational** |
