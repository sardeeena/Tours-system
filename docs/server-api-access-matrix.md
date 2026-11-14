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

The exact technical and user-management route list is enforced by the automated access-matrix test.

## Public and provider routes

| Area | Routes | Boundary |
|---|---|---|
| Public | `/api/chat`, `/api/health`, `/api/config`, `/api/tours` | Public data only; catalogue fails closed |
| Booking/contact | `/api/bookings/create`, `/api/inquiries*`, `/api/contact` | Input validation, rate limits, booking-specific controls |
| Newsletter | `/api/newsletter*` | Subscription/unsubscribe validation and rate limits |
| Visitor privacy | `/api/visitor/consent`, `/api/visitor/events` | Consent-aware, minimized telemetry |
| Provider callbacks | `/api/webhooks/resend`, `/api/webhooks/whatsapp` | Provider signature/verification; no browser staff permission |
| Session | `/api/auth/verify-session` | Returns only the caller's verified session context |

## Important scope boundary

Most admin CRUD screens use the Supabase client directly. Their effective authorization is enforced by Postgres RLS policies and restricted RPCs. A server-route audit cannot certify those paths. Changes to table policies, privileged functions, storage policies, or role/permission assignment flows require their own database-focused review and pgTAP coverage.

## Change procedure

1. Add or update the route in the inventory test and this document.
2. Classify it as public, provider-verified, permission-gated, or Super Admin/AAL2.
3. Add a regression assertion for the required guard.
4. Keep authorization on the server/database; hiding a frontend control is not authorization.
