# Production remediation tracker — Awesome Adventure Tours

**Scope:** `sardeeena/Tours-system`, `awesomeadventure.tours`, Supabase project `uvtbtpxtrrmaublrztgv` only.  
**Baseline:** read-only production audit performed 17 November 2026.  
**Rule:** This tracker is not permission to fabricate business facts, credentials, schedules, invoices, or customer data. Production records must be preserved.

## Implemented in this pull request

- [x] Replace unsupported homepage trust claims about owning boats/transfers, universal guide credentials, universal free pickup, guaranteed 100% weather/cancellation refunds, and guaranteed multilingual WhatsApp support with qualified, tour-specific wording.
- [x] Prevent the AI concierge from presenting its legacy static catalogue as live/verified inventory.
- [x] Fail safely when the AI service is unavailable: no invented excursion cards, prices, availability, inclusions, pickup promises, or payment methods.
- [x] Add the omitted admin authorization, abuse-prevention, password-recovery, destination, phase, schema-parity, and analytics-boundary test scripts to CI. Rewrote the legacy `test:admin` script as isolated role/error tests with no Supabase reads or writes, eliminating its prior unsafe dummy-identifier mutations.
- [x] Correct current project identity and secret-handling instructions in active operator documentation.
- [x] Replace obsolete Kemet Spirit catalogue-seed and 33-table Supabase setup instructions with current Awesome Adventure Tours project-scoped guidance.
- [x] Retain historical audit/phase reports as records; do not rewrite applied migration history.

## P0 — Operational booking integrity (requires implementation and operator data)

- [x] Add a staged departure-capacity linkage: operator-created departures are created/updated atomically with the existing `tour_availability` capacity row; new bookings inherit the linked `departure_id`; booking insert/status changes recalculate departure and availability passenger counts. Existing unlinked availability remains untouched until an operator schedules it. Multiple departures for the same tour/date remain blocked because the current availability model has one row per tour/date.
- [ ] Reconcile the existing availability pool with actual departures before enforcing the new constraint. The current production data has no operational departures/assignments, so a fail-closed cutover must be staged with the operator to avoid unintentionally disabling every booking.
- [ ] Review vessel maintenance state. The M/Y Red Sea Star VIP maintenance date was 15 November 2026 and is overdue as of the audit date; confirm inspection/maintenance completion before assigning it to any departure.
- [ ] Populate explicit pickup-zone assignments for all tours where pickup is offered. Current fallback behavior can expose every active zone for tours without explicit mappings; remove that broad fallback after data is reconciled.
- [ ] Confirm each pickup surcharge and display it before booking. Five of seven active zones currently carry a supplement.
- [ ] Add operational acceptance checks for guide, vessel, departure time, pickup route, passenger manifest and weather/closure handling.

## P1 — Customer-facing truth, finance and communications

- [ ] Reconcile public claims against the signed supplier agreements and documentary evidence for Egyptian operator licensing, PADI/guide credentials, vessel ownership, crew qualifications, departure frequency and support hours.
- [ ] Keep the public site explicit that excursions may be delivered by independent local suppliers unless the operator confirms a different legal/contractual relationship.
- [ ] Complete legal invoice identity: registered legal name, registered address, tax/registration details and required invoice fields. Finance invoice company details are currently incomplete; do not issue legal invoices until owner data is supplied. Draft previews now carry a clear 'NOT A TAX INVOICE' watermark.
- [ ] Reconcile paid bookings to invoices and create missing invoices through an auditable workflow. Current invoice UI is not a complete issuance workflow.
- [ ] Implement cancellation-to-refund orchestration with idempotency, provider reconciliation, audit events and customer/staff notification. Do not automatically refund bookings without an approved business rule and provider support.
- [ ] Decide whether online payments are required and choose an eligible provider for the business jurisdiction and settlement bank. Stripe/PayPal are not connected; do not expose online payment options until sandbox and production webhooks pass.
- [x] Replace localStorage-backed staff notification authority with a database inbox and SQL scanner over bookings, inquiries, payments, leads, CRM tasks, departures and pickup schedules. A production worker runs the idempotent scan every five minutes; localStorage is development-only.
- [x] Add durable database-generated staff alerts for payment pending/overdue, cancellation requests, departure assignment gaps, pickup confirmations and CRM follow-ups/tasks, with unique deduplication keys and a five-minute server worker. Customer-facing event delivery and scheduled email/WhatsApp reminders remain separate work.
- [ ] Configure and test WhatsApp Cloud API only after Meta credentials, approved templates, consent and opt-out rules are supplied.

## P2 — Catalogue, content, localization and AI

- [x] Rechecked the reported blog detail 404 against the live database using the actual anon role. The post is published and anon RLS returns it; the earlier audit used a misspelled slug (`mohamed` instead of the real `mohammed`). No database or content correction is required for that article.
- [ ] Improve thin blog posts with original, useful, fact-checked content; do not auto-expand articles with generic filler.
- [ ] Add itinerary steps to tours after the operator confirms real sequence and times. Do not invent schedules.
- [ ] Complete destination landing pages only when they have meaningful, accurate excursion inventory and unique content.
- [x] Build the AI concierge's published-catalogue context from the public RLS-scoped Supabase catalogue on every request. Static legacy catalogue is no longer used for recommendations. Date-specific live availability lookup and provider assignment data remain excluded from the chatbot until explicitly queried.
- [ ] Configure `GEMINI_API_KEY` in Hostinger server-side environment only, then test rate limits, safety, usage caps, outage behavior and grounded responses.
- [ ] Publish reviewed translations for the supported locales; static UI dictionaries alone do not mean localized public pages or customer messages are available.
- [ ] Add real review ingestion and moderation. Keep aggregate ratings hidden unless they are backed by genuine published reviews.

## P3 — Security, reliability, QA and documentation

- [ ] Enable Supabase leaked-password protection when the current plan supports it; retain strong password policy, rate limits and MFA until then.
- [ ] Complete verified TOTP MFA for every privileged staff/admin account; the audit found one of two admins without a verified factor.
- [ ] Review unused-index advisor notices against query plans and workload. Do not drop indexes blindly.
- [x] Add a database-backed `/api/health/ready` endpoint separate from liveness. It currently checks public catalogue database reachability; provider and queue readiness probes remain to be added.
- [ ] Add browser end-to-end and mobile acceptance tests for registration, booking, payment, cancellation, invoice, admin navigation, translation and support flows.
- [ ] Verify the admin interface visually on real mobile/tablet browsers; code-level responsive behavior is not a substitute for device testing.
- [ ] Continue cleaning active docs of old project references. Keep historical reports clearly marked as historical and never use old seed/bootstrap scripts against production.

## Owner inputs required (do not put secrets in GitHub or chat)

1. **Operations:** confirmed vessel maintenance status, actual departure plan, per-tour vessel/guide rules, pickup-zone eligibility and surcharge approval.
2. **Legal/finance:** exact legal entity and registered address, tax/registration details, invoice requirements, settlement currency and bank/provider eligibility.
3. **Credentials:** Gemini API key, WhatsApp Cloud API token/phone-number ID/app secret/webhook verify token, and any chosen payment provider credentials. Add them only in Hostinger server-side environment.
4. **Business evidence:** current operator licence, supplier agreements, guide/skipper certificates, support hours/languages, and exact weather/cancellation terms.
5. **Content:** approved translations, verified itinerary details, blog subject-matter review and genuine customer review consent.
6. **Ground transport:** actual driver roster, vehicle roster/registration/capacity and an owner-approved process for verifying driver identity. The current schema has no normalized driver/vehicle directory; pickup assignments therefore require explicit operator-entered details and do not treat guides as drivers.

## Release gates

- No database migration that disables current booking inventory may be applied until departure and pickup data is reconciled and tested against a production snapshot.
- No production secrets may be committed or requested in chat.
- No fabricated operational or legal details may be published.
- Merge only after CI, local migration/RLS tests, production build and scoped review pass. Deploy and verify separately; a merged PR is not proof of live production readiness.
