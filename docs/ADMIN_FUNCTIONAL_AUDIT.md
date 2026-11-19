# Admin Functional Audit

## Scope and safety

This audit covers the admin application only. It does not change production records, booking statuses, departures, capacity, pricing, translations, or customer data. GA4/GTM remains deferred. WhatsApp and online payment gateway setup are intentionally excluded because they are not configured yet.

## Route inventory

The admin application declares 61 tab identifiers. The sidebar exposes the 59 primary destinations; four identifiers are internal/legacy routes rather than separate sidebar destinations: `availability`, `crm_customers`, `crm_inquiries`, and `tour_edit`.

| Admin section | Tabs included | Automated coverage |
|---|---|---|
| Overview & Sales | Main dashboard, sales, operations, customers, finance, dashboard builder, tours, new tour, bookings, support tickets | Route-to-component coverage; existing dashboard, booking, reporting, and server authorization tests |
| Operations | Departures, calendar, availability, manifests, pickup schedules, vessels, guides, assignments, weather, documents | Route coverage; operations service and RLS tests; live staff registry and database-generated guide IDs |
| Finance | Payments, invoices, refunds, balances, revenue, reports | Route coverage; ledger, refund, finance workflow and reporting consistency tests |
| Messages & Communications | Communication center, email, WhatsApp, templates, notifications, history | Route coverage; provider status and communication validation tests; external sends require configured providers |
| Customers & CRM | CRM dashboard, leads, customers, inquiries, tasks, follow-ups, conversations, segments, timeline | Route coverage; database-backed staff assignment, lead/task persistence, communications, customer history and finance ledger checks |
| Website Content | Newsletter, destinations, categories, pickup locations, extras, coupons, FAQs, reviews, media, SEO, pages, translations, blog | Route coverage; database-backed service checks, media metadata/storage consistency and existing content/localization tests |
| Administration & Security | Settings, access control, technical control center | Route coverage; RBAC, MFA, admin authorization and technical-control tests |

## Issues found and addressed in this branch

- **Tour management:** production no longer silently falls back to browser-local demo tours when Supabase or the schema is unavailable. Tour status changes and deletes require a confirmed database row. Booking-count lookup now fails closed, so an unknown booking count cannot be treated as zero. Child relation write errors are surfaced, and a newly created parent tour is rolled back if its related content cannot be saved.
- **Tour add-on pricing:** production reads and writes use the database; local cache updates happen only after successful persistence.
- **Operations staff:** guide listing no longer returns seeded demo guides in production. New guide saves return the actual database-generated ID. Guide deletion confirms a database row before updating cache. The guide registry displays load errors separately from an empty staff list.
- **Passenger manifests:** manifest rows now read from `booking_passengers`, carry a stable booking/passenger index, and save through a database upsert. A migration backfills existing passenger indexes. Manifest tour lists no longer fall back to demo tours, and load failures are visible. Pickup schedule updates validate required assignment details before changing the booking and attempt to roll back the booking status if the schedule write fails.
- **Operations conflict checks:** missing vessels or staff records now block assignment. Inactive, day-off, leave and unavailable crew are treated as conflicts. If the conflict-check query itself fails, the assignment form displays the error and disables saving rather than treating the result as conflict-free.
- **Operations data states:** departures, assignments, pickups, availability, weather and vessel tabs now show a visible retryable error state instead of appearing empty when a live query fails.
- **Vessel safety:** new vessels default to inactive with blank capacities, registration, port and inspection fields. Activating a vessel requires verified capacity, registration, home port and a current safety inspection. Vessels referenced by departure history cannot be deleted; they must be retired or marked under maintenance.
- **Availability controls:** blackout dates require an actual operational reason. Capacity cannot be reduced below booked passengers, and availability writes must be confirmed by the database.
- **CRM assignments:** lead, task and follow-up assignment choices now come from the permission-filtered staff directory. Customer actions and conversation logs are attributed to the signed-in user. Staff UUIDs are persisted with communications and notes. Hard-coded sample staff names were removed.
- **CRM data integrity:** lead reads/writes, conversations, communications, notes, activities, customer records and tags no longer treat local browser cache as a production fallback. New leads default to zero estimated value rather than an invented amount; stage totals respect each lead's currency.
- **Customer profile:** payment transactions, refunds and reviews are loaded from their database tables instead of browser-local history. The payment panel displays actual payment transaction records.
- **CRM dashboard:** outstanding balances are calculated from payment and processed-refund ledger rows; non-EUR lead estimates are not added into an EUR total.
- **Customer directory:** profile/customer query errors are surfaced instead of returning a partial directory assembled from stale local cache.
- **Inquiries:** public submissions report failure if the database insert fails instead of claiming local-only success. Inquiry-to-lead conversion now has a permission-gated UI action backed by the atomic conversion RPC. Conversion creates a genuinely new lead with zero estimated value and attributes the activity to the signed-in staff profile; it no longer invents a €150 estimate or marks the lead as already contacted. Converted inquiries are retained as source audit records.
- **Booking lookup:** database and authorization errors are no longer returned as false 'booking not found' results, and production booking lookup cannot fall back to browser-local records.
- **Newsletter:** subscriber status updates and deletion confirm that a real database row was affected.
- **Inquiries:** public submissions report failure if the database insert fails instead of claiming local-only success. Inquiry-to-lead conversion now has a permission-gated UI action backed by the atomic conversion RPC. Conversion creates a genuinely new lead with zero estimated value and attributes the activity to the signed-in staff profile; it no longer invents a €150 estimate or marks the lead as already contacted.
- **Coupons, FAQs and site settings:** production reads/writes no longer silently use local seeded data or stale browser settings when the database is unavailable.
- **Media library:** uploads require a persisted `media_assets` row; failed metadata writes trigger storage rollback. Metadata edits, listing, audits and cleanup surface errors. Storage cleanup checks current role assignments rather than a legacy profile role field.
- **WhatsApp UI:** removed the fabricated default sender phone number. Provider readiness continues to come from the server-side status endpoint.

## Automated checks added

- `test:admin-module-coverage`: verifies all 61 typed admin tabs are routed, all primary sidebar destinations map to known tabs, and the four internal aliases remain explicitly documented.
- `test:admin-data-connections`: checks production fail-closed behavior, live staff assignment, CRM database persistence, customer payment/refund/review reads, tour CRUD safety, settings/content persistence and media metadata/storage handling.
- Both tests are added to CI alongside the existing authorization, database, finance, operations, localization and dependency-security suites.

## Remaining verification

1. CI must pass on this branch before merge.
2. A signed-in Super Admin browser session is needed for real click-through testing of each rendered tab, dialogs, create/edit/delete controls and live API responses. No credentials should be sent in chat.
3. WhatsApp sends and online gateway payment flows remain untestable until their providers are configured. Manual payment recording and provider-disabled states will still be tested without creating production transactions.
4. Any production write test will use disposable test records only after an isolated/staging environment is available; production customer, booking, departure and payment data will not be used as test fixtures.
5. The current booking notification adapter is explicitly unconfigured; booking confirmation/cancellation delivery is a separate gap from WhatsApp and payment gateway setup and must be wired to a server-side provider/worker before it can be considered complete.
