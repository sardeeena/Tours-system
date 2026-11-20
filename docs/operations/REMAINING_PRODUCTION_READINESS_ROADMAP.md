# Remaining Production Readiness Roadmap

**Scope:** Awesome Adventure Tours only  
**Repository:** `sardeeena/Tours-system`  
**Website:** `awesomeadventure.tours`  
**Supabase project:** `uvtbtpxtrrmaublrztgv`

This roadmap tracks work intentionally left outside the comprehensive audit-remediation release. It does not authorize changing production data, enabling unverified payment channels, or publishing unreviewed claims/content.

## Release 1 — Safe database and application rollout

**Goal:** deploy the merged remediation without risking existing bookings or capacity.

- [x] Compare the production migration ledger with the `main` migration directory after merge (2026-11-21).
- [ ] Back up the production database and record a verified backup/restore point. **Release blocker:** the connected tooling cannot create or verify this point; obtain dashboard evidence before any production migration.
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

### Production migration drift recorded (2026-11-21)

Read-only comparison against Supabase project `uvtbtpxtrrmaublrztgv` found 156 applied migration versions and 161 SQL migration files on `main`.

Seven repository migrations are not recorded as applied in production:
- `20261119180000_refine_blog_seo_titles.sql`
- `20261119210000_short_remaining_blog_seo_titles.sql`
- `20261119220000_crm_inquiry_conversion_quality.sql`
- `20261119234000_reporting_bi_data_integrity.sql`
- `20261119235000_harden_bi_reporting_rpcs.sql`
- `20261120020000_secure_public_form_writes.sql`
- `20261120030000_coupons_require_content_permissions.sql`

Two production ledger versions have no same-version file in the current repository: `20261119164928` (`refine_blog_seo_titles`) and `20261119191838` (`short_remaining_blog_seo_titles`). The repository contains later-timestamped files with the same migration names. Do not assume equivalence or rewrite migration history; compare the SQL effects and document the canonical history before applying anything.

Read-only policy inspection also found that production still permits anonymous direct inserts into `inquiries` and `newsletter_subscriptions`, and the coupon policies do not yet match the current content-permission model. The application source contains server-side inquiry/newsletter endpoints using the server Supabase client, but the deployed Hostinger commit and production service-role configuration must be verified before public insert policies are removed.

The seven pending files must be reviewed in dependency order after backup verification. In particular, validate that server-side inquiry/newsletter submissions work before applying `20261120020000`. Do not apply any of the seven migrations until the backup/restore point is verified, historical migration versions are reconciled, and the matching application deployment is confirmed.

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

**Implementation status:** Implemented and merged. PR #206 delivered the multi-departure model; PR #249 added and passed the true concurrent final-seat regression test. Merge commit: `434382f08787ff99c494f4adb2d03fc807edf592`.

The multi-departure schema and booking flow are implemented. Each confirmed `departures` row is an independent slot. `tour_availability` remains a daily summary, with the original daily capacity preserved across the configured times. New bookings store the selected departure and its per-person prices; notifications and secure booking lookup return that exact slot.

- [x] Confirm the requirement for multiple departures per tour/date.
- [x] Implement departure-centric slots, unique tour/date/start-time constraints, daily summaries and selected-departure booking allocation.
- [x] Backfill future configured times without modifying historical bookings. Existing daily capacity is split across slots; dates with active unassigned legacy bookings are excluded.
- [x] Update operator scheduling, customer booking selection, capacity checks, booking notifications and secure booking lookup.
- [x] Add regression coverage for multiple same-day slots, independent capacities, private per-person pricing, and fail-closed ambiguous legacy booking calls.
- [ ] Complete operator verification of provisional slot capacities, actual times and resource assignments before confirming slots for public booking.
- [x] Add a true multi-session concurrency test for simultaneous reservations against the same final available places (PR #249; disposable local Supabase CI stack; exactly one of two concurrent requests succeeds).
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
