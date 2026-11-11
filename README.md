# Kemet Spirit — Excursions, Booking & Operations Platform

Kemet Spirit is a full-stack tour and excursion booking platform for the Red Sea tourism market. It combines a public discovery website, customer booking experience, customer account area, and a role-protected operations/admin platform.

- **Production:** https://kemetspirit.com
- **Repository:** https://github.com/sardeeena/Tours-system
- **Production branch:** `main`
- **Hosting:** Hostinger Node.js application
- **Database/Auth/Storage:** Supabase project `mktrtoctcjyokclpdeui`

> **Important architecture note:** this is not a static-only Vite website. Express serves the built frontend and the application's `/api/*` routes. Production must run the Node.js server process.

## Contents

- [Capabilities](#capabilities)
- [Architecture and request flow](#architecture-and-request-flow)
- [Technology stack](#technology-stack)
- [Repository layout](#repository-layout)
- [Requirements](#requirements)
- [Local development](#local-development)
- [Environment configuration](#environment-configuration)
- [Build and run](#build-and-run)
- [Supabase database, Auth, RLS and migrations](#supabase-database-auth-rls-and-migrations)
- [Authentication and authorization](#authentication-and-authorization)
- [External integrations](#external-integrations)
- [Testing and CI](#testing-and-ci)
- [Hostinger deployment](#hostinger-deployment)
- [Production operations and release checklist](#production-operations-and-release-checklist)
- [Security rules](#security-rules)
- [Documentation map](#documentation-map)

## Capabilities

### Public website and catalogue
- Browse, search and filter excursions, destinations and categories.
- Tour detail pages with galleries, itinerary, inclusions/exclusions, FAQs and related content.
- Published catalogue content and approved public settings are read from Supabase.
- Responsive layouts and PWA support.

### Booking and customer experience
- Multi-step booking with passenger, date, pickup and add-on information.
- Server/database availability and capacity validation.
- Booking references, voucher-related flows and customer booking lookup.
- Customer authentication, account and booking history.

### Administration and operations
- Role-based admin access and super-admin security controls.
- Tour, destination, category and media management.
- Booking and customer operations.
- Departures, availability, fleet, guides and assignments.
- CRM leads, tasks and customer records.
- Reviews, promotions, finance, payments, invoicing and reporting modules.

A visible screen or menu is not proof that its complete workflow is operational. Production capability depends on valid data, migrations, RLS, provider configuration and end-to-end verification.

## Architecture and request flow

```text
Browser
  ├── Vite-built React application (dist/)
  └── HTTPS requests to the Express application
          ├── Public and authenticated /api/* routes
          ├── Server-side authentication/authorization checks
          ├── Public Supabase client (publishable key + RLS)
          ├── Privileged server Supabase client (server-only secret)
          └── Optional providers: Gemini, Resend, WhatsApp

Supabase
  ├── PostgreSQL database and incremental migrations
  ├── Auth (users, sessions, TOTP MFA)
  ├── Row-Level Security and database authorization
  └── Storage (public and private buckets)
```

The browser uses the public/publishable Supabase key. Sensitive operations run on the server and/or through database functions with explicit grants and authorization checks. Public catalogue rendering must not use the service-role/secret client to bypass RLS.

The Express server trusts one reverse-proxy hop for Hostinger's forwarded client address. Its in-process rate limiter is an additional layer; database-side atomic limits protect sensitive operations where implemented.

## Technology stack

| Layer | Technology |
|---|---|
| Language | TypeScript 7 |
| Frontend | React 19, React DOM 19 |
| Frontend tooling | Vite 8, React Vite plugin |
| Styling | Tailwind CSS 4 |
| UI/animation/icons | Motion, Lucide React, Recharts |
| Backend | Node.js 22, Express 4 |
| Database | Supabase PostgreSQL (production observed on PostgreSQL 17) |
| Authentication | Supabase Auth, TOTP MFA |
| Authorization | PostgreSQL RLS, role-based and action-level permission checks |
| Storage | Supabase Storage |
| AI integration | Google Gemini via `@google/genai` (optional) |
| Email integration | Resend (optional) |
| Messaging integration | WhatsApp Cloud API (optional) |
| Build | Vite + esbuild |
| Tests | TypeScript scripts via tsx, pg-mem, Supabase CLI/pgTAP |
| CI | GitHub Actions |

The authoritative package versions and scripts are in [package.json](./package.json). The CI workflow is [ci.yml](./.github/workflows/ci.yml).

## Repository layout

```text
.
├── .github/
│   └── workflows/ci.yml       # TypeScript/build/security and isolated DB CI
├── docs/
│   ├── README.md              # Documentation index
│   ├── guides/                # Setup, hosting, Supabase and operator guides
│   ├── operations/            # Owner action checklist and runbooks
│   ├── reports/               # Audit, readiness and implementation reports
│   └── catalogue-seed.md      # Catalogue import notes
├── public/                    # Static assets served by the frontend
├── scripts/
│   ├── README.md              # Script inventory and safe usage
│   └── *.ts                   # Tests, verification and controlled utilities
├── src/
│   ├── components/            # React UI components
│   ├── contexts/              # Application/auth contexts
│   ├── data/                  # Typed content and booking constants
│   ├── lib/                   # Shared clients, guards and utilities
│   └── server/                # Server-side modules/workers
├── supabase/
│   ├── config.toml            # Local Supabase CLI configuration
│   ├── migrations/            # Ordered incremental SQL migrations
│   └── tests/                 # Database tests (pgTAP)
├── .env.example               # Safe environment-variable template
├── complete_schema.sql        # Fresh-project schema reference; not a live reset
├── index.html                 # Vite HTML entry point
├── package.json               # Dependencies, scripts and Node engine
├── server.ts                  # Express application source
├── tsconfig.json              # TypeScript compiler configuration
└── vite.config.ts             # Vite/PWA/dev-server configuration
```

Some folders contain additional nested modules. Treat the tree above as a map of the major boundaries, not an exhaustive listing.

### Why test scripts remain in `scripts/`

The test and utility entry points are referenced directly by `package.json` and CI. Their paths are intentionally kept stable to avoid breaking test commands or relative imports during a documentation-only reorganization. Their purpose and grouping are catalogued in [scripts/README.md](./scripts/README.md).

## Requirements

- Node.js **22.x** (the package engine is `>=22.0.0 <23.0.0`).
- npm compatible with Node.js 22.
- Git.
- A Supabase project for database/Auth/Storage development.
- Docker for running the local Supabase stack and database tests through the Supabase CLI.
- Hostinger Node.js hosting (or another Node host) for production.

## Local development

1. Clone the repository:

   ```bash
   git clone https://github.com/sardeeena/Tours-system.git
   cd Tours-system
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create your local environment file:

   ```bash
   cp .env.example .env
   ```

4. Replace placeholders with credentials from your own development environment. Never copy production secrets into a public client variable or commit a real `.env` file.

5. Start the Express/Vite development server:

   ```bash
   npm run dev
   ```

6. Open `http://localhost:3000` unless your local configuration specifies another port.

The development server is started by `tsx server.ts`; Vite is integrated with the Express development process. Use the package scripts rather than launching a separate static preview when testing API-backed features.

## Environment configuration

[.env.example](./.env.example) is the canonical safe template. In production, configure variables in Hostinger's Node.js application environment settings. Do not upload a secret-bearing `.env` file into a public web directory.

| Variable | Required | Scope and purpose |
|---|---|---|
| `NODE_ENV` | Yes in production | Set to `production`. Non-production Supabase projects are permitted only in development/test mode by the project guard. |
| `PORT` | Host-provided | Hostinger normally injects this. Local fallback is 3000. |
| `SUPABASE_URL` | Yes | Server-side Supabase project URL; production is pinned to the Kemet Spirit project. |
| `VITE_SUPABASE_URL` | Frontend build | Same Supabase URL embedded in the frontend bundle. |
| `SUPABASE_ANON_KEY` | Yes | Public/publishable key used for user-scoped server requests. |
| `VITE_SUPABASE_ANON_KEY` | Frontend build | Public/publishable key embedded in browser code; RLS must protect all data. |
| `SUPABASE_SECRET_KEY` | Yes for privileged server operations | Server-only modern Supabase secret key. Never expose to browser code. |
| `SUPABASE_SERVICE_ROLE_KEY` | Legacy fallback only | Legacy service-role JWT fallback; leave empty when using the modern secret key. |
| `CORS_ALLOWED_ORIGINS` | Optional | Comma-separated additional allowed origins. |
| `GEMINI_API_KEY` | Optional | Server-side Gemini API key for the AI concierge. |
| `RESEND_API_KEY` | Optional | Server-side Resend API key. |
| `RESEND_FROM_EMAIL` | Optional | Verified Resend sender address. |
| `RESEND_FROM_NAME` | Optional | Sender display name; defaults to Kemet Spirit. |
| `BOOKING_NOTIFICATION_WORKER_ENABLED` | Optional; default false | Enable only after Resend credentials and delivery tests pass. |
| `WHATSAPP_ACCESS_TOKEN` | Optional | Server-side WhatsApp Cloud API token. |
| `WHATSAPP_PHONE_NUMBER_ID` | Optional | WhatsApp Cloud API phone-number ID. |
| `WHATSAPP_GRAPH_API_VERSION` | Optional | Graph API version in `vNN.N` format. |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Optional metadata | WhatsApp Business Account ID. |
| `WHATSAPP_FROM_NUMBER` | Optional metadata | Configured sender number. |

### Supabase key handling

- Prefer the modern `sb_publishable_...` key for public/publishable key variables.
- Use the modern `sb_secret_...` key only on the server.
- Legacy JWT keys are accepted only when their decoded roles are the expected `anon` or `service_role`.
- Never place a secret/service-role key in a `VITE_*` variable, frontend source, GitHub, logs, or browser storage.
- A publishable key is intentionally public; RLS and server-side authorization are the security boundary.

### Build-time versus runtime variables

Vite variables prefixed with `VITE_` are embedded during the frontend build. After changing them in Hostinger, rebuild and redeploy. Server-only variables are read by the Node process at runtime; restart/redeploy after changing them.

## Build and run

The production build command is:

```bash
npm run build
```

It performs two steps:

1. `vite build` compiles the React frontend into `dist/`.
2. `esbuild` bundles `server.ts` for Node.js as `server.js`, while leaving external packages external.

Start the production application with:

```bash
npm start
```

This executes `node server.js`. The Express process serves the built frontend and API routes and listens on the platform-provided `PORT` (or 3000 locally). `npm run preview` is a Vite preview utility; it is not the production server.

## Supabase database, Auth, RLS and migrations

The production Supabase project is `mktrtoctcjyokclpdeui` at `https://mktrtoctcjyokclpdeui.supabase.co`. The local Supabase CLI project identifier is configured in [supabase/config.toml](./supabase/config.toml). Local CLI settings do not replace the production dashboard configuration.

### Migration policy

- Existing production database: apply only reviewed, missing, ordered migrations from `supabase/migrations/`.
- Check the live migration ledger before applying any migration.
- Back up before destructive or data-transforming changes.
- Never replay a migration blindly or reset the production database to repair schema drift.
- `complete_schema.sql` is a fresh-project schema/provisioning reference; **do not run it against the live project as a reset or routine update**.
- Run database tests against a clean, isolated local Supabase stack before merging migration changes.

Typical local database workflow (requires Docker and the Supabase CLI):

```bash
supabase start
supabase db reset
supabase test db
supabase stop
```

Use the installed CLI's `--help` output and current Supabase documentation before using new or changed CLI commands. Never use local reset commands against the production project.

### RLS and privileged database code

- Enable RLS on exposed application tables and write policies for the actual ownership/role model.
- An authenticated role is not, by itself, authorization to access every row.
- Keep privileged `SECURITY DEFINER` functions in non-exposed schemas where possible; pin a safe `search_path`, validate callers and explicitly restrict grants.
- Review views for RLS behavior and use security-invoker views where appropriate.
- Do not create broad client policies to silence advisor findings.
- Do not drop unused-index findings without checking query plans, foreign-key coverage and actual workload.
- Keep the migration history and the live schema in parity.

## Authentication and authorization

- Supabase Auth handles identity, sessions and password recovery.
- The application reads the authoritative staff role from the database; client-side role state is not the authorization boundary.
- Database authorization is enforced through RLS and permission functions.
- Super-admin sensitive operations require an AAL2 session when MFA enforcement applies.
- TOTP enrollment requires the user to enroll and verify the authenticator factor. An unverified factor must never be displayed as enabled.
- After enrolling MFA, sign out/in and verify the dashboard and protected actions behave as expected.
- Password reset and email-confirmation redirect URLs must be configured for the production domain in Supabase Auth.

Supabase Free-plan limitation noted in the November 2026 review: leaked-password protection is a Pro-plan feature. Do not claim it is enabled or attempt to bypass the plan restriction.

## External integrations

### Resend email

Resend is optional. Configure a verified sending domain/address, `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in Hostinger. Test delivery and failure handling before setting `BOOKING_NOTIFICATION_WORKER_ENABLED=true`. Keep it false until verified.

### WhatsApp Cloud API

WhatsApp is optional. Configure the access token, phone-number ID and Graph API version before testing message delivery. Keep credentials server-side and do not enable a sending workflow until templates/permissions and delivery are confirmed.

### Google Gemini

Gemini is optional. Set `GEMINI_API_KEY` in the server environment. Do not expose it through a `VITE_*` variable.

### Payments

Do not advertise or enable online payment methods until the selected provider's server-side payment creation, signed webhook verification, idempotency, reconciliation and refund/cancellation behavior have been implemented and tested. A payment option visible in the UI is not evidence of a live payment integration.

## Testing and CI

Run the checks locally:

```bash
npm run lint
npm run build
npm run test:all
```

Useful individual checks include:

| Command | Purpose |
|---|---|
| `npm run test:catalogue` | Catalogue import validation/dry-run |
| `npm run test:parity` | Database schema parity |
| `npm run test:admin` | Admin persistence and RLS error handling |
| `npm run test:security` | Admin RBAC and privilege-escalation protections |
| `npm run test:abuse` | Abuse prevention and rate-limit behavior |
| `npm run test:routes` | Application route/build checks |
| `npm run test:recovery` | Password recovery/session behavior |
| `npm run test:comm` | Communication-provider configuration validation |
| `npm run test:booking` | Booking identifier resolution |
| `npm run test:supabase-project` | Production Supabase project guard |
| `npm run test:experiences-destinations` | Dynamic catalogue/destination behavior |
| `npm run test:audit-6-2` | Phase 6.2 dynamic data audit |
| `npm run test:staging-6-3` | Phase 6.3 staging/fallback checks |
| `npm run test:admin-ops-7` | Operations, departures, fleet and staff workflows |
| `npm run test:phase-8` | Finance and workflow validation |

`npm run test:all` runs the package's full ordered test sequence. GitHub Actions also runs TypeScript/build/security checks and starts an isolated Supabase stack to replay migrations and run pgTAP tests. A green CI run does not replace production smoke tests.

## Hostinger deployment

Configure the Hostinger Node.js application for the repository's `main` branch:

1. Select Node.js **22.x**.
2. Connect `sardeeena/Tours-system` and deploy `main`.
3. Configure the required environment variables in Hostinger before building.
4. Install dependencies with `npm install`.
5. Build with `npm run build`.
6. Set the start command to `npm start` (runs `node server.js`).
7. Ensure the process binds to the Hostinger-provided `PORT`.
8. Confirm the platform is running the latest intended commit and that the Node process is healthy.
9. Smoke-test the homepage, catalogue, tour details, availability, booking creation, customer portal, admin login and required API routes.

Do not deploy this application as static-only hosting of `dist/`: that omits the Express API and server-side functionality. Keep server secrets in Hostinger environment settings, not in the repository.

## Production operations and release checklist

The operator-owned tasks that still require access to dashboards, real data or real devices are maintained in [docs/operations/OWNER_ACTION_CHECKLIST.md](./docs/operations/OWNER_ACTION_CHECKLIST.md). Complete that checklist before declaring the service fully operational.

Release gate:

- [ ] CI passes on the exact commit intended for deployment.
- [ ] Hostinger is running that exact commit with Node.js 22.
- [ ] Supabase migration ledger and schema parity are verified.
- [ ] Auth, MFA, RLS and privileged grants are verified.
- [ ] Published tours and real departures/availability are correct.
- [ ] A complete test booking can be created, retrieved and managed.
- [ ] Email delivery is tested before notification worker activation.
- [ ] Payment methods are enabled only after provider/webhook verification.
- [ ] Password recovery and redirects work on the production domain.
- [ ] Desktop and mobile production smoke tests pass.
- [ ] Logs show no recurring application errors, unauthorized access or unexpected rate-limit failures.

## Security rules

1. Never commit `.env`, credentials, access tokens, personal customer data or production database exports.
2. Never expose Supabase secret/service-role keys or provider tokens to browser code.
3. Keep RLS enabled on exposed application tables and test both allowed and denied access.
4. Use incremental, reviewed migrations for production.
5. Back up before destructive data changes.
6. Restrict privileged functions and validate the caller inside the database.
7. Keep optional provider workflows disabled until their credentials and delivery paths are verified.
8. Do not interpret an advisor's informational finding as an instruction to make a potentially destructive change without workload analysis.

## Documentation map

Start at [docs/README.md](./docs/README.md). Important references:

- [Owner action checklist](./docs/operations/OWNER_ACTION_CHECKLIST.md)
- [Hostinger deployment guide](./docs/guides/HOSTINGER_DEPLOYMENT_GUIDE.md)
- [Setup guide](./docs/guides/SETUP_GUIDE.md)
- [Supabase guide](./docs/guides/SUPABASE.md)
- [Audit and phase reports](./docs/reports/)
- [Script inventory](./scripts/README.md)
- [Supabase migrations](./supabase/migrations/)

## License

See [LICENSE](./LICENSE).
