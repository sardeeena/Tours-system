# Remaining Production Readiness Roadmap

**Scope:** Awesome Adventure Tours only  
**Repository:** `sardeeena/Tours-system`  
**Website:** `awesomeadventure.tours`  
**Supabase project:** `uvtbtpxtrrmaublrztgv`

This roadmap tracks work intentionally left outside the comprehensive audit-remediation release. It does not authorize changing production data, enabling unverified payment channels, or publishing unreviewed claims/content.

## Release 1 — Safe database and application rollout

**Goal:** deploy the merged remediation without risking existing bookings or capacity.

- [ ] Confirm the production migration ledger and migration files after merge.
- [ ] Back up the production database and record the backup/restore point.
- [ ] Review the forward migrations in order, especially:
  - `20261117130000_expand_staff_notification_categories.sql`
  - `20261117140000_durable_staff_notification_scanner.sql`
  - `20261117160000_queue_cancellation_and_payment_emails.sql`
  - `20261117170000_departure_capacity_hardening.sql`
  - `20261117180000_index_content_translation_reviewer.sql`
  - `20261117190000_idempotent_booking_cancellation_event.sql`
- [ ] Apply migrations through the approved Supabase release process; do not assume a successful local replay means production has been migrated.
- [ ] Verify migration ledger, grants/RLS, triggers, queue behavior and scheduled worker configuration.
- [ ] Deploy the matching application commit to the Awesome Adventure Tours Hostinger site only after required migrations succeed.
- [ ] Run post-deploy health/readiness, authentication/authorization, booking, cancellation, notification, pickup and finance smoke tests.
- [ ] Reconcile existing bookings and availability read-only first. Produce a reviewed mapping before linking any historical records to departures; never auto-link ambiguous records.
- [ ] Confirm zero unintended changes to customer, booking, payment, invoice, availability and user records.

**Acceptance criteria:** migration history is consistent; all production smoke tests pass; no existing booking/capacity record is changed without an approved reconciliation; rollback/restore instructions are verified.

## Release 2 — Owner-provided business configuration

These items require real business decisions or credentials. Do not fabricate values or activate features with placeholders.

### Legal finance identity
- [ ] Owner supplies legal entity name, registered address, tax/registry identifiers and applicable invoice requirements.
- [ ] Verify requirements with the appropriate local accounting/tax adviser.
- [ ] Configure and test invoice numbering, required fields, tax calculations and document wording.
- [ ] Keep invoices as drafts until the required identity and compliance checks are complete.

### Payment provider
- [ ] Owner selects a provider eligible for the business jurisdiction and settlement bank.
- [ ] Verify merchant onboarding, supported currencies, settlement, fees, refunds and dispute process.
- [ ] Configure sandbox credentials and signed webhook verification.
- [ ] Test success, decline, duplicate webhook, delayed settlement, refund and reconciliation cases.
- [ ] Enable production payment methods only after owner approval and successful end-to-end tests.

### AI concierge
- [ ] Add `GEMINI_API_KEY` as a server-side Hostinger secret (never commit it or expose it to browser code).
- [ ] Verify rate limits, failure behavior, logging/redaction and prompt-injection protections.
- [ ] Test that answers use only current published catalogue data and never invent price, availability, pickup, inclusions or payment status.

### WhatsApp
- [ ] Owner provides Meta Cloud API app credentials, phone number ID, app secret and webhook verification token through a secure channel.
- [ ] Configure webhook signature verification and secret rotation.
- [ ] Obtain approval for message templates and document consent, opt-out and retention policy.
- [ ] Test inbound/outbound delivery, retries, duplicate events and opt-out enforcement before enabling customer messaging.

**Acceptance criteria:** each integration has documented owner approval, server-side secrets, verified webhook security, sandbox/test evidence and a tested failure path before production activation.

## Release 3 — Localization and content quality

- [ ] Confirm the launch language list and language priority with the owner.
- [ ] Inventory all public pages, tour descriptions, blog posts, transactional emails, booking flows and admin-facing customer messages.
- [ ] Prepare human-reviewed translations; do not treat UI dictionaries as complete translated content.
- [ ] Verify localized prices, dates, currencies, RTL layout, metadata, canonical/hreflang behavior and language switching.
- [ ] Review thin blog content and replace it with original, accurate, useful material.
- [ ] Publish customer reviews only with evidence and customer consent; never invent testimonials, ratings or review counts.
- [ ] Check all translated operational, safety, cancellation and refund wording with a qualified reviewer.

**Acceptance criteria:** every supported locale has reviewed content for the agreed launch scope; no mixed-language critical booking/payment flow; SEO metadata and language alternates validate.

## Release 4 — Ground transport and operating data

- [ ] Owner supplies verified driver roster and vehicle roster, including active status, registration, passenger capacity and required licence/insurance evidence.
- [ ] Design and approve normalized driver/vehicle records and assignment relationships before expanding the schema.
- [ ] Define pickup zones, eligibility, surcharges, service hours and exception handling from confirmed operating policy.
- [ ] Record real tour itineraries, departure assignments, guide/vessel assignments, maintenance completion and supplier/licensing evidence.
- [ ] Add validation preventing assignment beyond driver/vehicle capacity or to expired/inactive resources.
- [ ] Test schedule conflicts, reassignment, cancellations and audit history.

**Acceptance criteria:** operational assignments reference verified resources and enforce capacity/eligibility; no invented names, times, vehicles or pickup promises are displayed.

## Release 5 — Capacity model evolution

**Implementation status:** Prepared in PR #206; pending CI and merge.

The multi-departure schema and booking flow are implemented. Each confirmed `departures` row is an independent slot. `tour_availability` remains a daily summary, with the original daily capacity preserved across the configured times. New bookings store the selected departure and its per-person prices; notifications and secure booking lookup return that exact slot.

- [x] Confirm the requirement for multiple departures per tour/date.
- [x] Implement departure-centric slots, unique tour/date/start-time constraints, daily summaries and selected-departure booking allocation.
- [x] Backfill future configured times without modifying historical bookings. Existing daily capacity is split across slots; dates with active unassigned legacy bookings are excluded.
- [x] Update operator scheduling, customer booking selection, capacity checks, booking notifications and secure booking lookup.
- [x] Add regression coverage for multiple same-day slots, independent capacities, private per-person pricing, and fail-closed ambiguous legacy booking calls.
- [ ] Complete operator verification of provisional slot capacities, actual times and resource assignments before confirming slots for public booking.
- [ ] Add a true multi-session concurrency test for simultaneous reservations against the same final available places.
- [ ] Run migration against a production-like copy and obtain owner sign-off before rollout.

**Acceptance criteria:** multiple departures can be independently booked and managed without overselling, cross-departure count leakage or loss of historical booking integrity. If the business does not need this capability, explicitly defer it and retain the current limitation.

## Release governance and final sign-off

For every release:
- [ ] Keep changes scoped to Awesome Adventure Tours and its Supabase project.
- [ ] Require green TypeScript/build and database migration/RLS tests.
- [ ] Treat skipped external preview jobs as distinct from passed tests; verify production migration state directly.
- [ ] Review security, RLS, service-role boundaries, webhook authentication, secrets and audit logging.
- [ ] Capture deployment SHA, migration versions, smoke-test evidence and rollback steps.
- [ ] Obtain owner sign-off for business/legal/payment/content decisions.

## Explicitly not done by this roadmap

- No production migration is applied by creating or merging this planning document.
- No payment, WhatsApp or AI integration is activated without the required owner credentials and verification.
- No legal tax invoice is issued without verified legal/tax details.
- No existing customer, booking, payment, invoice, user or availability record is deleted or reset.
- No KemetSpirit or other project is in scope.
