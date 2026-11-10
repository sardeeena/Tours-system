# Kemet Spirit — Excursions, Booking & Operations Platform

Kemet Spirit is a full-stack tour and excursion booking platform with a customer portal and an operations/admin CRM. It is built for the Red Sea tourism market and is deployed for the production domain **https://kemetspirit.com**.

> **Production note:** This repository contains both a Vite/React frontend and an Express Node.js backend. It is not a static-only website. The production deployment must run the built Node server so that booking, authentication-related server routes, communication endpoints, and other `/api/*` handlers are available.

## Project status and verified environment

Last project review: **10 November 2026**.

| Area | Verified information |
|---|---|
| Production domain | `https://kemetspirit.com` |
| Hosting | Hostinger Node.js hosting |
| Source control | GitHub repository, production branch `main` |
| Supabase project | `mktrtoctcjyokclpdeui` |
| Supabase URL | `https://mktrtoctcjyokclpdeui.supabase.co` |
| Supabase region | Frankfurt (`eu-central-1`) |
| Database engine | PostgreSQL 17.11 |
| Runtime | Node.js `>=20 <23` |
| Frontend | React 19, TypeScript 7, Vite 8 |
| Backend | Express 4, bundled from `server.ts` to `server.js` |
| Database/Auth | Supabase PostgreSQL, Auth and RLS |

### Live database and application review

The following are point-in-time observations from the production review, not guarantees that the counts remain unchanged:

- Supabase project health was reported as healthy.
- The public schema contained **55 tables**, **98 RLS policies**, and **31 public functions** at the time of review.
- The catalogue contained **13 tours** and **7 destinations**.
- There were **no bookings, Auth users, or admin profiles** at the time of the review.
- The `departures` and `tour_availability` tables had no records. Consequently, the public booking flow could not return bookable departure slots.
- The admin area was protected by its login flow.
- The booking page displayed a temporary live-availability error during the review.
- The legacy paths `/tours`, `/destinations`, `/privacy`, and `/terms` returned 404 during that route check. Confirm the current route map before publishing links to these paths.

These observations identify launch tasks; they do not mean the site is fully production-ready. In particular, availability data, a first administrator, email delivery configuration, route cleanup, and a complete end-to-end booking test still need confirmation.

## Main capabilities

### Public website and catalogue
- Excursion discovery and filtering.
- Tour detail pages with galleries, itineraries, inclusions, exclusions, FAQs and related content.
- Destination and category data sourced from Supabase.
- Responsive customer-facing experience and PWA support.

### Booking and customer portal
- Multi-step booking flow with guest and pickup information.
- Availability and capacity validation against the database.
- Booking reference and voucher-related customer flows.
- Customer authentication, account access and booking history.
- Booking lookup and customer booking pages.

### Admin and operations
- Protected admin dashboard and role-based access control.
- Tour, destination, category and media management.
- Booking and customer management.
- Departures, availability, fleet, guides and operations assignments.
- CRM leads, tasks and customer records.
- Reviews and promotions management.
- Finance, payments, invoicing and ledger-related workflows.

Feature availability depends on the database being migrated and populated, correct RLS policies, configured server credentials, and production data. Do not treat a visible UI module as proof that its live workflow has passed end-to-end testing.

## Architecture

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript 7, Vite 8 |
| Styling/UI | Tailwind CSS 4, Motion, Lucide |
| Backend | Node.js, Express 4 |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Authorization | PostgreSQL Row-Level Security and application RBAC |
| Storage | Supabase Storage |
| AI | Google Gemini through a server-side endpoint |
| Email | Optional Resend integration |
| WhatsApp | Optional WhatsApp Cloud API integration |
| Build | Vite frontend build + esbuild backend bundle |

The production server listens on the `PORT` supplied by the hosting platform (or port 3000 locally). The build creates the static frontend in `dist/` and the Node server bundle `server.js`.

## Repository documentation

- [`manual.md`](./manual.md) — extended operations and integration guide. Some sections in this legacy guide still refer to the previous brand, Vercel, or old repository names; verify those instructions against this README and the current Hostinger setup before using them.
- [`setup.md`](./setup.md) — database and administrator setup notes. This guide also contains legacy hosting/branding references that should be treated as historical until updated.
- [`complete_schema.sql`](./complete_schema.sql) — canonical schema/provisioning reference for a fresh database only.
- [`supabase/migrations/`](./supabase/migrations/) — incremental database migrations for existing environments.

## Requirements

- Node.js **20.x, 21.x or 22.x** (package engine is `>=20.0.0 <23.0.0`).
- npm.
- A Supabase project configured with the repository's migrations/schema.
- Hostinger Node.js hosting or another host that can run the Express server.

## Local setup

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/sardeeena/Tours-system.git
   cd Tours-system
   npm install
   ```

2. Create a local environment file:

   ```bash
   cp .env.example .env
   ```

3. Fill in the Supabase public/publishable key and server-only secret key as described in [Environment variables](#environment-variables). Do not commit `.env`.

4. Start the application in development mode:

   ```bash
   npm run dev
   ```

   The Express/Vite development server uses port 3000 by default.

## Environment variables

The authoritative starter template is [`.env.example`](./.env.example). Configure variables in the Hostinger Node.js application settings for production; do not upload a secret-bearing `.env` file to a public web root.

| Variable | Required | Purpose / security |
|---|---:|---|
| `NODE_ENV` | Production: yes | Set to `production` on the live server. |
| `PORT` | Host-provided | Hostinger should provide this. Locally the server defaults to 3000. |
| `SUPABASE_URL` | Yes | Server-side project URL. Production code pins the project to `mktrtoctcjyokclpdeui`. |
| `VITE_SUPABASE_URL` | Build: yes | Same project URL, embedded into the frontend at build time. |
| `SUPABASE_SECRET_KEY` | Yes | Server-only Supabase secret key (`sb_secret_...`). Never expose or prefix with `VITE_`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Legacy fallback only | Legacy service-role JWT fallback. Leave empty when using the modern secret key. |
| `SUPABASE_ANON_KEY` | Yes | Public/publishable key available to server-side user-scoped requests. |
| `VITE_SUPABASE_ANON_KEY` | Build: yes | Same public/publishable key embedded in the browser. It is not a secret; RLS must protect the database. |
| `CORS_ALLOWED_ORIGINS` | Optional | Comma-separated additional allowed origins. The Kemet Spirit production domains are already allowlisted. |
| `GEMINI_API_KEY` | Optional | Server-side Gemini API access for the AI concierge. |
| `RESEND_API_KEY` | Optional | Server-side Resend API key for email delivery. |
| `RESEND_FROM_EMAIL` | Optional | Verified sender address used by email delivery. |
| `RESEND_FROM_NAME` | Optional | Sender display name; defaults to `Kemet Spirit`. |
| `BOOKING_NOTIFICATION_WORKER_ENABLED` | Optional | Set to `true` only after Resend is configured; otherwise keep `false`. |
| `WHATSAPP_ACCESS_TOKEN` | Optional | WhatsApp Cloud API access token; server-only. |
| `WHATSAPP_PHONE_NUMBER_ID` | Optional | WhatsApp Cloud API phone-number ID. |
| `WHATSAPP_GRAPH_API_VERSION` | Optional | Graph API version in `vNN.N` format. |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Optional | WhatsApp Business Account metadata. |
| `WHATSAPP_FROM_NUMBER` | Optional | Configured sender-number metadata. |

### Supabase key rules

- Use the modern Supabase **publishable** key (starts with `sb_publishable_`) for `SUPABASE_ANON_KEY` and `VITE_SUPABASE_ANON_KEY`.
- Use the modern Supabase **secret** key (starts with `sb_secret_`) for `SUPABASE_SECRET_KEY`.
- The code also recognizes legacy JWT keys with the expected `anon` and `service_role` roles.
- Never put a secret/service-role key in a `VITE_*` variable, frontend source, GitHub, or a browser.
- The frontend publishable key is intentionally public. Security depends on correctly configured RLS and server-side authorization.

### Resend and WhatsApp

Resend is optional and has intentionally not been configured in this repository documentation with a real credential. Configure it in Hostinger when ready. The durable booking notification worker remains disabled unless `BOOKING_NOTIFICATION_WORKER_ENABLED=true` and valid `RESEND_API_KEY` and `RESEND_FROM_EMAIL` values are present.

WhatsApp delivery is optional. Configure the access token, phone-number ID and Graph API version before enabling or testing the WhatsApp sending workflow. Never commit these values.

## Supabase database and migration safety

The production project is already established. **Do not run `complete_schema.sql` against the live database as a reset or as a routine update.** It is a full-schema provisioning reference intended for a fresh project.

For the existing production project:

1. Review the migration files in `supabase/migrations/`.
2. Check which migrations have already been applied to the live project.
3. Apply only the missing, ordered incremental migrations.
4. Verify schema parity and security after each migration.
5. Take/confirm a database backup before any destructive or data-transforming change.

Never rerun a migration blindly. A migration that has already been applied must not be replayed unless it is explicitly designed to be safely repeatable and the current database state has been checked.

### RLS and privileged functions

- Keep RLS enabled on application tables that contain customer, booking, finance, or operational data.
- Review every `SECURITY DEFINER` function for its owner, search path, grants and intended caller roles.
- Do not grant anonymous or authenticated execution to privileged functions merely to silence an advisor warning.
- Avoid broad policy changes or dropping indexes solely because an advisor labels them unused; assess query plans and application behavior first.
- Admin promotion must be performed through the trusted provisioning mechanism documented in the current migration/manual, not by allowing users to edit their own profile role.

## First administrator setup

The production review found no Auth users or admin profiles at that time. Create the first administrator only after the production environment is configured:

1. Register the intended administrator through the website's supported registration flow.
2. Verify the account exists in Supabase Auth.
3. Use the trusted database-operator provisioning procedure implemented by the project's current migrations. The legacy guide references `public.set_admin_role_by_email(email)`; first verify that this function exists on the live project and that its execution is restricted to trusted database operators before invoking it.
4. Sign in at `/admin` and verify that the server and RLS permit the expected admin workflows.
5. Never expose the provisioning function to `anon` or ordinary `authenticated` users.

Do not send passwords, Supabase secret keys, Resend keys, or WhatsApp tokens in chat or commit them to GitHub.

## Hostinger production deployment

The production app needs a Node.js runtime because Express serves the API and the built frontend.

1. Connect the GitHub repository and deploy the `main` branch to the Hostinger Node.js application.
2. Use Node.js 20, 21 or 22.
3. Install dependencies with `npm install`.
4. Add the required production environment variables in Hostinger before building.
5. Build with:

   ```bash
   npm run build
   ```

6. Set the application start command to:

   ```bash
   npm start
   ```

   This runs `node server.js`, which is generated by the build step. Do not configure the site as a static-only deployment that serves `dist/` while omitting the Express process.

7. Confirm the application is bound to the platform-provided `PORT`, the health endpoint responds, and API requests reach the Node server.
8. After deployment, test the homepage, excursion listing/detail pages, booking availability, booking creation, customer portal, admin login, and all required API endpoints.

The `VITE_*` variables are read during the Vite build. If they change in Hostinger, rebuild and redeploy the frontend. Server-only variables are read by the Node process at runtime; restart/redeploy after changing them.

## Tests and quality checks

The package currently defines these checks:

```bash
npm run lint
npm run build
npm run test:all
```

Individual test commands:

| Command | Coverage |
|---|---|
| `npm run test:catalogue` | Catalogue import validation/dry-run |
| `npm run test:parity` | Database schema parity |
| `npm run test:admin` | Admin dashboard persistence and RLS error handling |
| `npm run test:security` | Admin RBAC and privilege escalation protections |
| `npm run test:abuse` | Abuse prevention and rate-limit behavior |
| `npm run test:routes` | Application route/build checks |
| `npm run test:recovery` | Password recovery/session behavior |
| `npm run test:comm` | Communication-provider credential validation |
| `npm run test:booking` | Booking identifier resolution |
| `npm run test:supabase-project` | Production Supabase project guard |
| `npm run test:experiences-destinations` | Dynamic catalogue/destination behavior |
| `npm run test:audit-6-2` | Phase 6.2 dynamic data audit |
| `npm run test:staging-6-3` | Phase 6.3 staging/fallback checks |
| `npm run test:admin-ops-7` | Operations, departures, fleet and staff workflows |
| `npm run test:phase-8` | Finance and workflow validation |

`npm run test:all` runs the complete sequence. A successful local test suite is necessary but does not replace live production smoke tests. Do not claim production readiness until the live booking, payment/collection, email, admin, and recovery paths have been tested with appropriate test data.

## Production launch checklist

- [ ] Hostinger Node.js app is running the current `main` build.
- [ ] `NODE_ENV=production` is set.
- [ ] Supabase URL and correct public and server-only keys are configured.
- [ ] Production Supabase project guard passes.
- [ ] Required incremental migrations are applied and schema parity passes.
- [ ] RLS and privileged function grants have been reviewed.
- [ ] First admin is securely provisioned and can sign in.
- [ ] At least one valid departure/availability record exists for each bookable tour/date.
- [ ] A full booking can be created, retrieved, and managed from the admin area.
- [ ] Email delivery is configured and tested before enabling the notification worker.
- [ ] WhatsApp is configured and tested only if this channel is required.
- [ ] Password reset and email confirmation redirect URLs use `https://kemetspirit.com`.
- [ ] Legacy links that currently return 404 are corrected or redirected.
- [ ] Sitemap, robots, canonical URLs, metadata, and structured data use the Kemet Spirit domain and brand.
- [ ] `npm run lint`, `npm run build`, and `npm run test:all` pass.
- [ ] Production smoke tests pass on desktop and mobile.

## Security and operational rules

1. Never commit `.env`, production credentials, personal customer data, or database exports.
2. Never expose Supabase secret/service-role keys or provider tokens to the browser.
3. Keep public data access narrow and protected by RLS.
4. Use incremental migrations for the live database; do not reset production to resolve schema drift.
5. Back up before destructive database changes and verify data after migrations.
6. Keep payment gateway credentials disabled until the selected provider's server-side flow and webhook verification are implemented and tested.
7. Keep email/WhatsApp integrations disabled until credentials and delivery flows are validated.

## License

See [`LICENSE`](./LICENSE).
