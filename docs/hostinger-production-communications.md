# Kemet Spirit production communication configuration

The booking notification worker runs inside the long-lived Hostinger Node.js server process. It consumes the durable `booking_notifications` Supabase Queue and sends booking-received email through Resend.

## Required server-only variables

Set these in Hostinger's Node.js application environment (never in Vite/browser variables):

- `SUPABASE_URL`: the Kemet Spirit Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY`: a genuine server-side Supabase secret key. A publishable/anon key is not sufficient for queue consumption.
- `RESEND_API_KEY`: Resend API key.
- `RESEND_FROM_EMAIL`: a sender address verified in Resend.
- `RESEND_FROM_NAME`: optional; defaults to `Kemet Spirit`.

The worker starts only in production when the Node server has a valid Supabase secret key and valid Resend sender configuration. If provider credentials are missing, the worker does not consume messages; durable queue messages remain available after configuration is completed.

After changing Hostinger environment variables, restart/redeploy the Node.js application so the worker can start with the new configuration.

## WhatsApp

The existing staff-initiated WhatsApp endpoint uses the Meta Cloud API and reads these server-only variables:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_GRAPH_API_VERSION` (for example, a supported `vXX.X` version)
- `WHATSAPP_BUSINESS_ACCOUNT_ID` (optional metadata)
- `WHATSAPP_FROM_NUMBER` (optional display metadata)

Automated booking WhatsApp delivery is intentionally not enabled by this worker. Business-initiated WhatsApp messages outside the customer-service window generally require an approved Meta message template; configure and validate the approved template flow before enabling automated WhatsApp sends.

## Operational behavior

- Booking creation and queue insertion occur in the same PostgreSQL transaction.
- The queue is durable and uses a visibility timeout so interrupted work can be retried.
- Email requests use a stable Resend idempotency key derived from the automation event.
- Failed deliveries retry with increasing delays and are archived after five attempts.
- Provider secrets are never stored in browser storage or returned by the communication status endpoint.
