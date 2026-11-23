# Server API access matrix

This inventory covers Express routes registered in `server.ts`. It is a regression boundary: a route added, removed, or renamed must be reviewed and classified in both this document and `scripts/test_server_api_access_matrix.ts`.

## Authentication and authorization layers

- Every `/api/*` request passes through `authenticateToken`. Requests without a Bearer token remain guests only where the route is intentionally public; an invalid supplied token is rejected.
- Privileged server APIs use the live, caller-scoped normalized RBAC context. The legacy `profiles.role` compatibility field does not grant server permissions.
- `/api/admin/*` endpoints are Super Admin-only and require AAL2 plus a server-only Supabase service-role client.
- Communications read operations require `communications.read`; dispatch and consent mutations require `communications.manage`.
- Webhook routes use provider-specific verification rather than a staff session.
- Public booking, catalogue, inquiry, newsletter, visitor-consent, and visitor-event routes remain public by design and must retain their own validation, rate limits, consent controls, and abuse protections.
- The admin modules that query Supabase directly from the browser are governed by database RLS policies and guarded RPCs, not by Express route middleware. Those policies must be audited separately; this inventory does not claim to replace or certify them.

## Protected server routes

| Method | Route | Required boundary |
|---|---|---|
| GET | `/api/communications/status` | `communications.read` |
| GET | `/api/communications/whatsapp/consent` | `communications.read` |
| POST | `/api/communications/email` | `communications.manage` |
| POST | `/api/communications/whatsapp/consent` | `communications.manage` |
| POST | `/api/communications/whatsapp` | `communications.manage` |
| GET/POST | `/api/admin/technical/*` | Normalized `super_admin` + AAL2 + server service-role key |
| GET/POST | `/api/admin/users/*` | Normalized `super_admin` + AAL2 + server service-role key |
| POST | `/api/admin/translations/generate-batch` | Normalized `super_admin` + AAL2; server-side Gemini + service-role only; creates drafts only |

The exact technical and user-management route list is enforced by the automated access-matrix test.

## Public and provider routes

| Area | Routes | Boundary |
|---|---|---|
| Public | `/api/chat`, `/api/health`, `/api/health/ready`, `/api/config`, `/api/tours` | Public liveness/readiness only; readiness exposes dependency state without secrets; catalogue fails closed |
| Booking/contact | `/api/bookings/create`, `/api/inquiries*`, `/api/contact` | Input validation, rate limits, booking-specific controls |
| Reviews | `POST /api/reviews/submit` | Public for guests and signed-in customers; strict validation, published-tour lookup, IP + atomic database rate limits, honeypot, pending moderation; server-only service-role write |
| Newsletter | `/api/newsletter*` | Subscription/unsubscribe validation and rate limits |
| Visitor privacy | `/api/visitor/consent`, `/api/visitor/events` | Consent-aware, minimized telemetry |
| Provider callbacks | `/api/webhooks/resend`, `/api/webhooks/whatsapp` | Provider signature/verification; no browser staff permission |
| Session | `/api/auth/verify-session` | Returns only the caller's verified session context |

## Important scope boundary

Most admin CRUD screens use the Supabase client directly. Their effective authorization is enforced by Postgres RLS policies and restricted RPCs. A server-route audit cannot certify those paths. Changes to table policies, privileged functions, storage policies, or role/permission assignment flows require their own database-focused review and pgTAP coverage.

## Customer-facing permission boundaries

| Customer action | Access model | Notes |
|---|---|---|
| Guest booking | Public server endpoint / guarded booking RPC | No direct anonymous writes to booking tables; server validates booking and uses trusted database operations. |
| Signed-in booking access | Authenticated, owner-scoped RLS | Customers can read their own bookings; update triggers limit self-service changes to pickup/contact details and cancellation requests. |
| Guest contact / inquiry | Public server endpoint | Validation, honeypot and rate limits; database writes use the server-only key. |
| Newsletter signup / unsubscribe | Public server endpoint | Subscription state is not writable directly by anonymous browser clients. |
| Tour reviews | Public server endpoint | Guest and signed-in submissions are accepted; reviews remain pending and unverified until staff moderation. |
| Support tickets | Authenticated customer portal | Ticket ownership is tied to an Auth user ID. Guests use the public inquiry/contact flow instead; internal notes and staff queues remain permission-gated. |
| Customer profile | Auth signup lifecycle + owner-scoped RLS | Customers can access their own profile; role, confirmation, and server-managed fields are protected by database triggers. |
| Customer CRM record | Owner-scoped RLS + protected update trigger | Self-service edits are limited to contact and preference fields; CRM/booking-derived fields remain protected. |
| File uploads | Storage bucket RLS | Avatars and tour media are public-read; avatar uploads are user-folder scoped; vouchers and support attachments are private and permission/ticket scoped. |

The live audit found 76 public tables with RLS enabled and no public table missing RLS. It also found stale anonymous table grants on tables that had no anonymous or PUBLIC RLS policy. The accompanying migration revokes those unnecessary grants without changing customer-facing server endpoints or authenticated staff policies.

## Change procedure

1. Add or update the route in the inventory test and this document.
2. Classify it as public, provider-verified, permission-gated, or Super Admin/AAL2.
3. Add a regression assertion for the required guard.
4. Keep authorization on the server/database; hiding a frontend control is not authorization.


## Localization API additions

- `GET /api/content-translations/resolve` is public and rate-limited. It returns only published and reviewed translation records, verifies the current source SHA-256 before returning them, and returns only the source record ID/slug (not the full source row).
- `GET /api/admin/translations/source` and `POST /api/admin/translations/generate-batch` are Super Admin + AAL2 only. The source helper computes checksums server-side; bulk generation uses the server Gemini key and writes draft records only.
- Locale-prefixed tour, destination, blog and static-page routes now resolve by translated slug, fail closed with 404/noindex if missing or stale, and render translated metadata/content when valid.
- Private locale-prefixed booking, customer portal and authentication routes are served as no-store/noindex application routes.
- The XML sitemap includes only reviewed translations whose source checksum is current. Localized pages emit reciprocal hreflang links only for same-entity translations that pass the same checksum check.
- `/api/config` advertises only the five existing interface dictionaries (`en,de,it,ro,ru`); planned locales are not advertised as complete.


### Public translation endpoints

- `GET /api/content-translations/resolve` — resolve a published, reviewed content translation by translated slug or stable entity key; verify live source checksum.
- `GET /api/content-translations/target` — map the current source/translated route to the selected locale's translated slug; private booking/account routes require a complete published UI catalog.
- `GET /api/content-translations/ui` — serve a complete reviewed UI catalog after source checksum validation.
- `GET /api/content-translations/locales` — advertise only locales with a complete reviewed UI catalog, reviewed coverage for every current public content/communication record, and synchronized localized communication templates.
- `GET /api/admin/translations/source` — Super Admin + AAL2 source snapshot/checksum helper.
