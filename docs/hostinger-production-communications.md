# Awesome Adventure Tours production communications configuration

The production Node.js server uses Resend for outbound email and Supabase for durable subscriber and communication records. Provider credentials remain server-only in Hostinger.

## Required Hostinger Node.js environment variables

Keep the existing Supabase values and set/verify these exact values in Hostinger hPanel:

- `SUPABASE_URL`: the Awesome Adventure Tours production Supabase project URL.
- `SUPABASE_SECRET_KEY` (or the existing `SUPABASE_SERVICE_ROLE_KEY`): a genuine server-side Supabase secret key. Never use a publishable/anon key for server-side queue or audit operations.
- `RESEND_API_KEY`: a Resend API key with permission to send from the verified sender domain.
- `RESEND_FROM_EMAIL=no-reply@mail.awesomeadventure.tours`: a sender address on the verified Resend sending domain.
- `RESEND_FROM_NAME=Awesome Adventure Tours`.
- `RESEND_REPLY_TO=reservation@awesomeadventure.tours`.
- `BOOKING_NOTIFICATION_EMAIL=reservation@awesomeadventure.tours`.
- `BOOKING_NOTIFICATION_WORKER_ENABLED=true`: enable only after the Resend key and sender address have been verified in the running app.

Do not add these values to Vite/browser variables, source code, GitHub, or chat. Do not replace the full Hostinger environment-variable set to change one value; preserve every existing key.

## Email workflows

- Newsletter signup is persisted in `public.newsletter_subscriptions` through the server-side API. A welcome email with the `REDSEA15` voucher is sent through Resend and recorded in `public.communication_messages`.
- Newsletter unsubscribe links require an explicit confirmation POST; automated email link scanners cannot unsubscribe a person by merely previewing the link.
- Staff-dispatched emails are written to `communication_messages` before dispatch and updated with the provider result.
- Booking-received emails are processed by the durable Supabase queue worker. Successful, failed, and retried sends are recorded in `communication_messages` and `automation_events`.
- Resend delivery, open, click, bounce, complaint, and delayed events are signature-verified and stored in `public.email_provider_events`; matching message statuses are updated in `public.communication_messages`. The Communications & Automation Hub reads the resulting status from the database.

## Booking notification worker

The worker starts only when `BOOKING_NOTIFICATION_WORKER_ENABLED=true`, the server has a genuine Supabase secret key, and valid Resend credentials are available. Keep the flag disabled until the required values are confirmed. If credentials are missing, the worker leaves queued notifications in Supabase for later processing.

After changing Hostinger environment variables, restart the Node.js application. Check the runtime logs for the explicit `Booking Notification Worker] Started` message and confirm that the missing-credentials warning is gone.

## Supabase Auth email delivery

Supabase Auth sends account confirmation, password recovery, magic-link, invite, and email-change messages independently of the app's Resend API routes. Configure custom SMTP in Supabase Dashboard → Authentication → Emails → SMTP Settings so these messages can reach real customers.

Use the verified Resend sending domain:

- Host: `smtp.resend.com`
- Port: `465` (SSL/TLS)
- Username: `resend`
- Password: your Resend API key (keep it only in Supabase's secure SMTP password field)
- Sender email: `no-reply@mail.awesomeadventure.tours`
- Sender name: `Awesome Adventure Tours`
- Admin/support email: `reservation@awesomeadventure.tours`

Keep the API key out of source code and browser environment variables. Save and use Supabase's built-in SMTP test if available. Review the Auth email templates for confirmation and password recovery links, and ensure the allowed redirect URLs include the production site. Supabase's default SMTP is rate-limited and is not intended for production delivery.

## WhatsApp

The existing staff-initiated WhatsApp endpoint uses the Meta Cloud API and reads these server-only variables:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_GRAPH_API_VERSION`
- `WHATSAPP_BUSINESS_ACCOUNT_ID` (optional metadata)
- `WHATSAPP_FROM_NUMBER` (optional display metadata)

Automated booking WhatsApp delivery is not enabled by the email worker. Business-initiated WhatsApp messages generally require an approved Meta message template; validate that flow separately before enabling automation.

## Operational safeguards

- Email provider credentials are never stored in browser storage or returned by the communications status endpoint.
- The public newsletter API is rate-limited and rejects invalid addresses.
- A newsletter signup is not reported as successful unless the database confirms it.
- A welcome email is never reported as sent unless Resend accepts it and returns a provider message ID.
- Staff email dispatches are not sent if the audit record cannot first be persisted.


## Resend webhook setup

After the webhook receiver is deployed:

1. In Resend, create a webhook endpoint: `https://awesomeadventure.tours/api/webhooks/resend`.
2. Subscribe to `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.opened`, `email.clicked`, `email.failed`, and `email.suppressed`.
3. Copy the webhook signing secret (starts with `whsec_`) into Hostinger as `RESEND_WEBHOOK_SECRET`. Never put it in GitHub or browser variables.
4. Save the webhook and redeploy/restart the Hostinger Node.js application.
5. Check Resend's webhook delivery logs and the admin Communications & Automation Hub after a real email event.

The receiver verifies the Svix signature against the raw request body, rejects stale/invalid signatures, and stores each event idempotently. Do not disable signature verification.
