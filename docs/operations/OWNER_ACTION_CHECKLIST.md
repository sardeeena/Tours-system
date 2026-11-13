# Awesome Adventure Tours — Owner Action Checklist

**Project:** Awesome Adventure Tours  
**Production URL:** https://awesomeadventure.tours  
**Repository:** https://github.com/sardeeena/Tours-system  
**Supabase project:** `mktrtoctcjyokclpdeui`  
**Last reviewed:** 11 November 2026

This checklist contains actions that require the project owner's access, choices, real-world operational data or device-based verification. Check an item only after completing it and recording any relevant evidence. A code change or a passing CI run does not automatically complete an owner action.

## Priority 1 — Required before treating production as fully ready

### 1. Enroll and verify super-admin MFA

- [ ] Sign in to https://awesomeadventure.tours using the designated super-admin account.
- [ ] Open the account/security or MFA settings panel.
- [ ] Start TOTP authenticator enrollment and scan the QR code using an authenticator app (for example, Google Authenticator, Microsoft Authenticator, 1Password or an equivalent).
- [ ] Enter the current six-digit authenticator code to verify the factor.
- [ ] Confirm the UI reports MFA as **enabled/verified**, not merely enrolled or pending.
- [ ] Sign out and sign in again; complete the MFA challenge.
- [ ] Confirm super-admin protected actions work with an AAL2 session.
- [ ] Store recovery codes securely if the application/Supabase flow provides them. Never share them in chat or commit them.

**Why this matters:** database authorization now requires AAL2 for protected super-admin permissions. The settings panel was corrected to recognize only a verified TOTP factor. The owner must complete enrollment on their own device.

### 2. Confirm bookable inventory and operational capacity

- [ ] Open the admin dashboard and review each tour intended for sale.
- [ ] Confirm each tour has correct published status, price, duration, pickup rules and capacity.
- [ ] Add or verify actual departures for the dates being sold.
- [ ] Add/verify availability and capacity for each departure.
- [ ] Confirm pickup zones, surcharges, extras/add-ons and booking cut-off rules.
- [ ] Confirm guides, vehicles/fleet and assignment requirements where the workflow uses them.
- [ ] Check that unavailable dates correctly appear unavailable to customers.
- [ ] Confirm catalogue data shown publicly matches the operational records.

**Important:** a published tour is not necessarily bookable. A tour without valid departure/availability records cannot offer a valid live slot.

### 3. Run a complete test booking

Use an owner-controlled test identity and a date/departure explicitly prepared for testing.

- [ ] Search for a tour on the public website.
- [ ] Select a date and party size with valid capacity.
- [ ] Select a pickup location and any intended add-ons.
- [ ] Submit the booking using test contact details.
- [ ] Confirm a unique booking reference is returned.
- [ ] Confirm the booking appears in the customer account/lookup flow.
- [ ] Confirm the booking appears in the admin dashboard.
- [ ] Verify passenger count, price, pickup fee, extras and total are consistent in every view.
- [ ] Test the admin status/update workflow.
- [ ] Verify capacity is reserved/updated correctly and cannot be oversold by concurrent requests.
- [ ] Cancel the test booking using the supported workflow and verify the resulting status/capacity behavior.
- [ ] Record the test reference and outcome in your internal operations log; do not put real customer details in GitHub.

Do not use a real customer's personal information for acceptance testing.

### 4. Verify account recovery and authentication

- [ ] Confirm Supabase Auth Site URL is `https://awesomeadventure.tours`.
- [ ] Confirm allowed redirect URLs include only the required production and local development callback URLs.
- [ ] Test registration/email confirmation if registration is enabled.
- [ ] Test password reset from request through email link to successful password update.
- [ ] Test expired/used recovery links and confirm a safe error is shown.
- [ ] Test customer sign-in/sign-out and session expiry.
- [ ] Test staff/admin sign-in and role-specific route restrictions.
- [ ] Confirm an ordinary customer cannot access staff/admin screens or privileged API operations.

### 5. Confirm Hostinger deployment

- [ ] Confirm the production Node.js application uses Node.js 22.x.
- [ ] Confirm the deployed branch is `main` and note the exact deployed commit SHA.
- [ ] Confirm the build command is `npm run build`.
- [ ] Confirm the start command is `npm start` (runs `node server.js`).
- [ ] Confirm Hostinger supplies `PORT` and the app binds to it.
- [ ] Confirm all required server-side environment variables are configured in Hostinger.
- [ ] Confirm no real `.env` file or secret was uploaded to the public web root.
- [ ] Open the homepage, catalogue, tour details, booking flow and admin login on desktop and mobile.
- [ ] Confirm the deployed build corresponds to the latest intended GitHub commit.

## Priority 2 — Communication and customer notifications

### 6. Configure Resend email (when ready)

- [ ] Verify a sending domain in Resend and complete the DNS records requested by Resend.
- [ ] Choose the intended sender address and confirm it is verified.
- [ ] Add `RESEND_API_KEY` to Hostinger server environment.
- [ ] Add `RESEND_FROM_EMAIL` and, if desired, `RESEND_FROM_NAME`.
- [ ] Keep `BOOKING_NOTIFICATION_WORKER_ENABLED=false` while configuring.
- [ ] Test a non-customer test email and verify inbox delivery, sender identity and links.
- [ ] Test booking notification delivery and failure/retry behavior.
- [ ] Only then set `BOOKING_NOTIFICATION_WORKER_ENABLED=true` and redeploy/restart.
- [ ] Monitor delivery failures and provider limits after activation.

Never paste API keys into GitHub, source code, or chat.

### 7. Configure WhatsApp Cloud API (optional)

Only complete this section if WhatsApp messaging is a required channel.

- [ ] Complete Meta Business and WhatsApp Business account verification as required.
- [ ] Obtain the WhatsApp access token and phone-number ID.
- [ ] Configure approved message templates where required for business-initiated messaging.
- [ ] Add `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_GRAPH_API_VERSION` to Hostinger.
- [ ] Add business-account/sender metadata if used by the app.
- [ ] Test delivery to an owner-controlled number.
- [ ] Confirm consent, opt-out and template rules before contacting customers.
- [ ] Monitor API errors and token expiry/rotation.

### 8. Configure Gemini (optional)

- [ ] Decide whether the AI concierge should be enabled.
- [ ] Create/restrict a Gemini API key for the intended project.
- [ ] Add `GEMINI_API_KEY` to Hostinger only.
- [ ] Test prompt safety, rate limits, error handling and usage/cost controls.

## Priority 3 — Security, Supabase and operational review

### 9. Understand the remaining Supabase password-security warning

- [ ] Decide whether/when to upgrade Supabase to a plan that includes leaked-password protection.
- [ ] Until then, acknowledge that the Security Advisor warning `auth_leaked_password_protection` remains unresolved on the Free plan.
- [ ] Do not attempt to bypass the plan restriction or claim the feature is enabled.
- [ ] Maintain strong password requirements, rate limits, MFA for privileged accounts and secure recovery flows.

**Last reviewed advisor snapshot (11 Nov 2026):** Security: 0 errors, 1 warning, 1 info; Performance: 0 errors, 0 warnings, 129 informational findings; Health: 0 errors, 0 warnings, 0 info. The one Security warning was leaked-password protection disabled. Advisor counts are point-in-time and must be refreshed for a new release.

### 10. Review Supabase informational findings safely

- [ ] Keep the backend-only `rate_limit_buckets` table inaccessible to ordinary browser roles; do not add broad client policies merely to silence the advisor.
- [ ] Review unused-index findings against query plans, foreign keys and production workload before removing anything.
- [ ] Re-run Security and Performance advisors after meaningful schema/security changes.
- [ ] Verify migration ledger and schema parity before and after database releases.
- [ ] Keep a current backup/recovery plan appropriate to the chosen Supabase plan.

### 11. Confirm production roles and access

- [ ] Confirm the designated super-admin account is correct.
- [ ] Confirm other team members have only the intended role (staff, manager or admin).
- [ ] Confirm each role can access only its permitted modules/actions.
- [ ] Confirm there is a documented recovery process if the super-admin loses the authenticator device.
- [ ] Review audit logs for unexpected privilege changes and sensitive operations.

## Priority 4 — Website quality and launch polish

### 12. Public website and SEO acceptance

- [ ] Verify all public navigation links and important routes.
- [ ] Confirm legacy 404 paths are redirected or removed from navigation/sitemaps.
- [ ] Verify page titles, descriptions, canonical URLs, sitemap and robots rules.
- [ ] Verify structured data matches real business/contact information and visible page content.
- [ ] Check images, mobile responsiveness, accessibility, keyboard navigation and loading states.
- [ ] Confirm privacy policy, terms, cancellation/refund policy and contact details are accurate and published.
- [ ] Check analytics/consent configuration if analytics are enabled.

### 13. Payments (only if online payments are required)

- [ ] Choose and onboard the payment provider.
- [ ] Confirm the provider supports the business jurisdiction, settlement currency and payout bank account.
- [ ] Implement server-side payment creation and signed webhook verification.
- [ ] Implement idempotency, payment status reconciliation, refunds and cancellation behavior.
- [ ] Test success, decline, timeout, duplicate webhook and refund scenarios in sandbox.
- [ ] Enable customer-facing online payment options only after production verification.

Do not assume a payment method shown in the UI is connected to a live payment provider.

## What is already handled in the repository / database (do not repeat without checking)

- [x] GitHub PRs #44, #45 and #46 merged; issue #39 closed (last recorded repository review).
- [x] Super-admin AAL2 database enforcement migration applied and tested for AAL1 denial/AAL2 authorization.
- [x] TOTP settings panel logic updated to detect only factors with `status === "verified"`.
- [x] Live migrations for customer/profile and public availability security, active pickup-fee validation, and super-admin AAL2 enforcement were recorded as applied in the last review.
- [x] RLS was reported enabled on all 59 public tables in the last database review.
- [x] No client-callable SECURITY DEFINER functions were found in the public schema in the last review.

These are historical verification results, not a substitute for checking the current deployment/database before a future release.

## Evidence log

Record completion date, tester and outcome for the critical checks:

| Check | Date | Result / evidence |
|---|---|---|
| Super-admin MFA verified |  |  |
| Booking inventory prepared |  |  |
| End-to-end test booking |  |  |
| Password recovery |  |  |
| Hostinger deployed commit |  |  |
| Resend delivery (if enabled) |  |  |
| WhatsApp delivery (if enabled) |  |  |
| Mobile production smoke test |  |  |

