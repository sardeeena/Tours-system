# 🏺 Awesome Adventure Tours — Red Sea Excursions & Operations Platform

> A full-stack tour discovery, excursion booking, customer experience, and operations platform built for the Red Sea tourism market.

[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite)](https://vite.dev/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com/)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=nodedotjs)](https://nodejs.org/)
[![Hostinger](https://img.shields.io/badge/Hosting-Hostinger-673DE6)](https://www.hostinger.com/)
[![PWA](https://img.shields.io/badge/PWA-Supported-orange?logo=pwa)](https://web.dev/progressive-web-apps/)

<p align="center">
  <strong>🌐 Production:</strong> <a href="https://awesomeadventure.tours">awesomeadventure.tours</a>
  &nbsp;•&nbsp;
  <strong>💻 Repository:</strong> <a href="https://github.com/sardeeena/Tours-system">Tours-system</a>
</p>

---

## 📑 Table of Contents

1. [Project Overview](#-project-overview)
2. [Recent Updates & Enhancements](#-recent-updates--enhancements)
3. [Documentation Guides](#-documentation-guides)
4. [Key Capabilities & Features](#-key-capabilities--features)
5. [Admin CMS, Operations, CRM & Finance](#-admin-cms-operations-crm--finance)
6. [Architecture & Tech Stack](#-architecture--tech-stack)
7. [Database & Supabase Integration](#-database--supabase-integration)
8. [Email, Newsletter & Communications](#-email-newsletter--communications)
9. [Project Structure](#-project-structure)
10. [Getting Started & Local Development](#-getting-started--local-development)
11. [Environment Variables](#-environment-variables)
12. [Automated Testing & Verification](#-automated-testing--verification)
13. [Production Build & Deployment](#-production-build--deployment)
14. [Production Readiness & Owner Actions](#-production-readiness--owner-actions)
15. [Security Guidelines](#-security-guidelines)
16. [License](#-license)

---

## 🌟 Project Overview

**Awesome Adventure Tours** is a full-stack tour and excursion booking platform serving the Red Sea tourism market. It combines a public discovery website, a customer booking experience, customer accounts, and a role-protected administration and operations platform.

- **Production website:** https://awesomeadventure.tours
- **GitHub repository:** https://github.com/sardeeena/Tours-system
- **Production branch:** `main`
- **Hosting:** Hostinger Node.js application
- **Database, authentication & storage:** Supabase

> **Architecture note:** This is not a static-only Vite website. Express serves the built frontend and the application's `/api/*` routes. Production must run the Node.js server process.

---

## 🆕 Recent Updates & Enhancements

### 🔐 1. Super-admin authentication hardening
- Added TOTP multi-factor authentication (MFA) enrollment and challenge flows for super-admin access.
- Enforced Supabase AAL2 for protected super-admin permissions.
- Added fail-closed authorization behavior when MFA status cannot be verified.
- Corrected MFA factor detection so an unverified TOTP factor is not treated as enabled.

### 🛡️ 2. Database and API security
- Hardened customer/profile access and public availability operations.
- Added active pickup-fee validation.
- Kept rate-limit storage backend-only rather than exposing it to browser roles.
- Retained explicit authorization and Row-Level Security (RLS) checks as core data-access boundaries.

### ✉️ 3. Premium email center and branded communications
- Added a dedicated, role-protected Email Center at `/admin/communications` with real message counts, recent verified Resend provider events, sender configuration diagnostics, webhook-secret presence and booking-worker status.
- Added a shared responsive navy-and-gold HTML email renderer using the Awesome Adventure Tours logo for staff-dispatched messages, inquiry notifications, newsletter welcome emails and booking notifications.
- Normalized sender mailbox parsing and added safe diagnostics that report configuration problems without exposing secrets.
- Made the Supabase-backed `communication_templates` catalogue the source of truth for business templates; template edits persist to the database and are recorded in CRM activity.
- Seeded the business email/WhatsApp template catalogue, including newsletter, support-ticket and post-trip template records. Ticket and post-trip templates are inactive until explicitly enabled.
- Replaced outdated admin branding with Awesome Adventure Tours branding.

### 📬 4. Supabase Auth email templates
- Added 13 branded HTML templates covering six authentication flows and seven account-security notifications.
- Added corresponding version-controlled entries to `supabase/config.toml` and setup instructions in [docs/email-system-setup.md](./docs/email-system-setup.md).
- Security notification templates are disabled by default in the repository configuration and should be enabled only after review.
- **Hosted-project distinction:** committing `config.toml` or HTML files does not automatically update the hosted Supabase Auth dashboard. Apply the templates under Authentication → Emails → Templates (or use the supported Supabase Management API), and configure SMTP and redirect URLs in the hosted project.

### 📮 5. Newsletter persistence and Resend delivery-event audit
- Newsletter subscriptions are stored in `public.newsletter_subscriptions`; the admin view reads persisted records.
- Anonymous visitors can subscribe, while subscription management is protected by confirmation-based unsubscribe handling and consent validation.
- Added `public.email_provider_events` as an idempotent audit trail for verified Resend webhook events.
- Webhook endpoint: `/api/webhooks/resend`. Configure the Resend webhook with the event types documented in [docs/email-system-setup.md](./docs/email-system-setup.md) and store its signing secret in the server environment.
- Provider events update communications delivery history when matching webhook events are received.

### 🗄️ 6. Supabase migration history and CLI reliability
- Pointed `supabase/config.toml` at the AwesomeAdventure Supabase project reference.
- Reconciled local migration filenames with the versions already recorded in production, including restoration of the historical `20261112164341` version as a comment-only migration placeholder.
- The subsequent `20261112170000` migration contains the final provider-event RBAC policy and business-template seed operations.
- CI starts an isolated local Supabase stack, replays the full migration history and runs pgTAP database tests.
- Use the Supabase CLI v3 command modes deliberately: local CI reset/test commands run against the local stack; production operations must explicitly specify the remote target and receive a separate review.

### 📚 7. Documentation and continuous integration
- Organized documentation into guides, operations, audit reports and phase reports.
- Added a dedicated owner action checklist for tasks requiring account access or real-world verification.
- GitHub Actions validates TypeScript, production builds, email renderer and communication checks, project isolation, migration replay and database security tests.
- A green CI result does not replace end-to-end acceptance tests against Hostinger, the live Supabase project and external email providers.

---

## 📖 Documentation Guides

| Guide | Description |
|---|---|
| [📚 Documentation index](./docs/README.md) | Main index of project documentation |
| [✅ Owner action checklist](./docs/operations/OWNER_ACTION_CHECKLIST.md) | Owner tasks and production acceptance checks |
| [🚀 Hostinger deployment guide](./docs/guides/HOSTINGER_DEPLOYMENT_GUIDE.md) | Production hosting and deployment reference |
| [⚙️ Setup guide](./docs/guides/SETUP_GUIDE.md) | Local setup and application configuration |
| [🗄️ Supabase guide](./docs/guides/SUPABASE.md) | Database, Auth, RLS and migration guidance |
| [✉️ Email system setup](./docs/email-system-setup.md) | Resend, webhook, Auth templates and SMTP setup |
| [🧪 Script inventory](./scripts/README.md) | Test and utility script purposes and safe usage |
| [📋 Audit reports](./docs/reports/audits/) | Historical audit and readiness reports |
| [📋 Phase reports](./docs/reports/phases/) | Historical implementation reports |

Historical reports describe the state at the time they were written. Check current code, database state and deployment before relying on an older finding.

---

## 🚀 Key Capabilities & Features

### 🏝️ Guest & Discovery Experience
- Browse, search and filter excursions, destinations and categories.
- Explore tour detail pages with galleries, itinerary information, inclusions/exclusions, FAQs and related content.
- Discover published catalogue content retrieved from Supabase.
- Responsive layouts and Progressive Web App (PWA) support.

### 🧾 Booking & Reservation Experience
- Multi-step booking with passenger, date, pickup and add-on information.
- Server/database availability and capacity validation.
- Booking references and customer booking lookup workflows.
- Booking-related customer account and history experiences.

### 👤 Customer Account
- Supabase Auth email/password authentication.
- Customer account and booking-related views.
- Password recovery and protected session behavior.

### 🖼️ Media & Content
- Supabase Storage integration for managed media.
- Tour media selection and assignment workflows.
- Protected catalogue and content administration.

> **Operational note:** A visible screen or button does not prove that its complete workflow is production-ready. Operational status depends on valid data, database policies, provider configuration and successful end-to-end verification.

---

## 🛡️ Admin CMS, Operations, CRM & Finance

The administration platform contains workflows for the following business areas. Access and operational readiness depend on configured permissions, production data and end-to-end verification.

1. **Executive & BI Analytics** — operational and business summaries.
2. **Tours & Excursions** — tour catalogue content and configuration.
3. **Destinations** — destination and regional organization.
4. **Categories** — excursion and activity taxonomy.
5. **Bookings & Reservations** — booking review and management.
6. **Availability & Departures** — dates, capacity and availability controls.
7. **Fleet & Vessels** — vehicle/vessel operational records.
8. **Guides & Captains** — staff records and assignment information.
9. **Operations Assignments** — coordinating resources with departures.
10. **CRM & Leads Pipeline** — lead stages, tasks and activity tracking.
11. **Customer Directory** — customer and booking-related records.
12. **Reviews Moderation** — review management.
13. **Coupons & Promotions** — discount and promotion configuration.
14. **Finance & Invoicing** — finance-related records and workflows.
15. **Media Library** — asset organization and tour media assignment.
16. **Communications & Email Center** — business templates, dispatch, message history and provider event visibility.

Role-based access and action-level authorization are enforced through application checks and database policies. Frontend navigation visibility is not an authorization boundary.

---

## 🛠️ Architecture & Tech Stack

| Layer | Technology |
|---|---|
| **Frontend framework** | React 19, React DOM 19 |
| **Language** | TypeScript 7 |
| **Frontend tooling** | Vite 8, React Vite plugin |
| **Styling** | Tailwind CSS 4 |
| **UI, motion & charts** | Lucide React, Motion, Recharts |
| **Backend runtime** | Node.js 22 |
| **HTTP server** | Express 4 |
| **Database** | Supabase PostgreSQL |
| **Authentication** | Supabase Auth, TOTP MFA |
| **Authorization** | PostgreSQL RLS, role-based and action-level permission checks |
| **Object storage** | Supabase Storage |
| **AI integration** | Google Gemini via `@google/genai` (optional) |
| **Email delivery** | Resend API and Supabase Auth SMTP |
| **Messaging integration** | WhatsApp Cloud API (optional) |
| **Build** | Vite + esbuild |
| **Testing** | TypeScript scripts via tsx, pg-mem, Supabase CLI and pgTAP |
| **CI/CD checks** | GitHub Actions |
| **Production hosting** | Hostinger Node.js application |

The authoritative dependency versions, Node.js engine requirement and npm commands are defined in [package.json](./package.json). The CI workflow is [ci.yml](./.github/workflows/ci.yml).

### 🔄 Application Request & Data Flow

```text
Customer / Admin Browser
        |
        v
React application built by Vite (dist/)
        |
        | HTTPS
        v
Express application (Node.js)
        |
        +---- Public and authenticated /api/* routes
        |
        +---- Server-side authentication and authorization
        |
        +---- User-scoped Supabase requests
        |        |
        |        +---- Publishable key + PostgreSQL RLS
        |
        +---- Privileged server operations
                 |
                 +---- Server-only Supabase secret key
                 +---- Explicit database permissions / checks

Supabase
  +-- PostgreSQL and incremental migrations
  +-- Auth, sessions and TOTP MFA
  +-- Row-Level Security and database authorization
  +-- Storage buckets and media objects

External services
  +-- Resend API for application/business emails
  +-- Resend SMTP for Supabase Auth messages
  +-- Optional Google Gemini
  +-- Optional WhatsApp Cloud API
```

The browser uses only public/publishable credentials. Privileged operations must remain server-side or be exposed through narrowly authorized database functions. Never expose a Supabase secret/service-role key to the browser.

---

## 🗄️ Database & Supabase Integration

The application uses Supabase for PostgreSQL, authentication and storage.

### Database change management
- Incremental SQL migrations are maintained in [`supabase/migrations/`](./supabase/migrations/).
- Database tests are maintained in [`supabase/tests/`](./supabase/tests/).
- `complete_schema.sql` is a fresh-project schema reference; it is **not** a production reset script.
- Review migration order and the remote migration ledger before applying changes.
- Back up before destructive or data-transforming operations.
- Never reset or overwrite production data to resolve schema drift.

### Supabase CLI v3 workflow
- CI uses Supabase CLI v3 to start an isolated local stack, run `supabase db reset`, and execute `supabase test db`.
- Local migration replay and pgTAP tests must not be confused with production migration operations.
- Before production deployment, compare local migration versions with the remote migration ledger.
- Use explicit remote targeting for hosted database commands (for example, `supabase migration list --remote` and reviewed `supabase db push --remote` workflows).
- Never use `migration repair`, reset, or destructive history edits as a shortcut. Investigate the missing version, restore the correct migration file or reconcile the history through a reviewed change.
- The migration file `20261112164341_email_center_provider_event_rbac.sql` is intentionally comment-only: it restores a historical version already present in production. The following `20261112170000_email_center_provider_event_rbac.sql` contains the final idempotent policy and template-seed SQL.

### Access control & database security
- Keep RLS enabled on exposed application tables.
- Use explicit grants and least-privilege policies.
- Validate both permitted and denied access paths.
- Restrict privileged functions and validate callers inside the database.
- Keep internal rate-limit storage inaccessible to ordinary browser roles.
- Require AAL2 for protected super-admin permissions when MFA enforcement applies.
- The Resend provider-event table is readable only by authenticated staff with the required communications or content permission; provider writes use the server-side privileged path.

### Supabase API key handling
- Prefer modern `sb_publishable_...` keys for browser/public use.
- Use modern `sb_secret_...` keys only in the server runtime.
- Legacy JWT keys are accepted only when their decoded roles match the expected `anon` or `service_role` role.
- Never place a secret/service-role key in a `VITE_*` variable, frontend source, GitHub, logs or browser storage.

---

## ✉️ Email, Newsletter & Communications

### Two separate email paths

1. **Supabase Auth email:** Supabase owns confirmation, invite, magic-link, recovery, email-change and security-notification tokens and templates. Resend SMTP is the delivery transport.
2. **Application/business email:** The Express server uses the Resend API for staff dispatches, inquiry acknowledgements, newsletter welcome messages and booking notifications.

Do not implement authentication token generation in application email routes. Do not assume that application communications history automatically contains every Supabase Auth email.

### Branded templates and Email Center
- Shared HTML renderer: [`src/utils/emailTemplate.ts`](./src/utils/emailTemplate.ts).
- Supabase Auth HTML files: [`supabase/templates/`](./supabase/templates/).
- Local Supabase Auth template declarations: [`supabase/config.toml`](./supabase/config.toml).
- Business templates are stored in `public.communication_templates`; the admin editor persists changes to Supabase.
- The Email Center is available at `/admin/communications` for staff with the relevant communications permissions.
- Template edits/deletions are recorded in CRM activity. Factory templates are soft-disabled rather than physically removed.

### Resend webhook and delivery audit
- Endpoint: `https://awesomeadventure.tours/api/webhooks/resend` (production).
- The endpoint validates the provider signature against the raw request body and stores verified events idempotently in `public.email_provider_events`.
- Configure the webhook signing secret as `RESEND_WEBHOOK_SECRET` on the server. A configured-secret indicator is not proof that the secret matches the provider.
- Subscribe to the supported events: `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.opened`, `email.clicked`, `email.failed` and `email.suppressed`.
- Delivery-event counts remain zero until actual provider webhook events are received.

### Required operational configuration
Typical server-side variables include:

```env
RESEND_API_KEY=<server-side Resend API key>
RESEND_FROM_EMAIL=no-reply@mail.awesomeadventure.tours
RESEND_FROM_NAME=Awesome Adventure Tours
RESEND_REPLY_TO=reservation@awesomeadventure.tours
BOOKING_NOTIFICATION_EMAIL=reservation@awesomeadventure.tours
BOOKING_NOTIFICATION_WORKER_ENABLED=false
RESEND_WEBHOOK_SECRET=<Resend webhook signing secret>
```

Set `BOOKING_NOTIFICATION_WORKER_ENABLED=true` only after the verified sender, delivery path, failure handling and real booking-notification acceptance test are complete. Use the bare verified sender email address in `RESEND_FROM_EMAIL`; do not include a display name or surrounding quotes.

For Supabase Auth SMTP, configure the Resend SMTP host, port, username and API-key password in the hosted Supabase dashboard. The hosted Auth templates and SMTP settings are configured separately from application environment variables. See [Email System Setup](./docs/email-system-setup.md).

---

## 📁 Project Structure

```text
.
├── .github/workflows/          # GitHub Actions CI
├── docs/
│   ├── guides/                 # Setup, Hostinger and Supabase guides
│   ├── operations/             # Owner checklist and runbooks
│   └── reports/                # Historical audit and phase reports
├── public/                     # Static frontend assets
├── scripts/                    # Tests and verification utilities
├── src/
│   ├── components/             # React UI components
│   ├── contexts/               # Application and authentication contexts
│   ├── data/                   # Typed content and constants
│   ├── lib/                    # Shared clients, guards and utilities
│   ├── server/                 # Server-side modules and workers
│   ├── services/               # Application service layer
│   └── utils/                  # Shared utilities and email renderer
├── supabase/
│   ├── config.toml             # Supabase CLI and Auth template configuration
│   ├── migrations/             # Ordered SQL migrations
│   ├── templates/              # Branded Supabase Auth/security emails
│   └── tests/                  # Database tests
├── .env.example                # Safe environment template
├── complete_schema.sql         # Fresh-project schema reference
├── index.html                  # Vite entry point
├── package.json                # Dependencies and npm scripts
├── server.ts                   # Express application source
├── tsconfig.json               # TypeScript configuration
└── vite.config.ts              # Vite configuration
```

This is a map of the main repository boundaries, not an exhaustive listing of every nested file. Script paths referenced by package scripts and CI are intentionally stable; see [scripts/README.md](./scripts/README.md).

---

## 💻 Getting Started & Local Development

### Prerequisites
- **Node.js:** 22.x (the package engine is `>=22.0.0 <23.0.0`).
- **npm:** compatible with Node.js 22.
- **Git:** to clone and manage the repository.
- **Supabase project:** for database, Auth and Storage development.
- **Docker:** for the local Supabase stack and database tests.

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/sardeeena/Tours-system.git
   cd Tours-system
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a local environment file:

   ```bash
   cp .env.example .env
   ```

4. Replace placeholders with credentials from your own development project. Never copy production secrets into browser variables or commit a real `.env` file.

5. Start the integrated Express/Vite development server:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000), unless your local configuration specifies another port.

The development command runs `tsx server.ts`. Use this integrated server when testing API-backed functionality; a standalone static preview does not exercise the complete application.

---

## 🔐 Environment Variables

[`.env.example`](./.env.example) is the canonical safe template. In production, configure secrets through Hostinger's Node.js application environment settings.

| Variable | Requirement | Purpose / scope |
|---|---|---|
| `NODE_ENV` | Required in production | Set to `production`; production Supabase project guard applies |
| `PORT` | Host-provided | Port supplied by Hostinger; local fallback is 3000 |
| `SUPABASE_URL` | Required | Server-side Supabase project URL |
| `VITE_SUPABASE_URL` | Frontend build | Supabase URL embedded in the frontend bundle |
| `SUPABASE_ANON_KEY` | Required | Public/publishable key for user-scoped server requests |
| `VITE_SUPABASE_ANON_KEY` | Frontend build | Public/publishable key embedded in browser code |
| `SUPABASE_SECRET_KEY` | Required for privileged server operations | Modern server-only Supabase secret key |
| `SUPABASE_SERVICE_ROLE_KEY` | Legacy fallback only | Legacy service-role JWT; leave empty when using the modern secret key |
| `CORS_ALLOWED_ORIGINS` | Optional | Comma-separated additional allowed origins |
| `GEMINI_API_KEY` | Optional | Server-side Gemini API key |
| `RESEND_API_KEY` | Optional | Server-side Resend API key |
| `RESEND_FROM_EMAIL` | Optional | Verified, bare Resend sender address |
| `RESEND_FROM_NAME` | Optional | Sender display name |
| `RESEND_REPLY_TO` | Optional | Reply-to address for business emails |
| `RESEND_WEBHOOK_SECRET` | Optional until webhook is configured | Resend webhook signing secret |
| `BOOKING_NOTIFICATION_EMAIL` | Optional | Operations inbox for booking notifications |
| `BOOKING_NOTIFICATION_WORKER_ENABLED` | Optional; default false | Enable only after email delivery and failure handling are tested |
| `WHATSAPP_ACCESS_TOKEN` | Optional | Server-side WhatsApp Cloud API token |
| `WHATSAPP_PHONE_NUMBER_ID` | Optional | WhatsApp Cloud API phone-number ID |
| `WHATSAPP_GRAPH_API_VERSION` | Optional | Graph API version in `vNN.N` format |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Optional metadata | WhatsApp Business Account ID |
| `WHATSAPP_FROM_NUMBER` | Optional metadata | Configured sender number |

### Build-time vs runtime configuration
- `VITE_*` values are embedded during the Vite build. Changing them requires a rebuild and redeploy.
- Server-only values are read by the Node.js process at runtime. Restart/redeploy after changing them.
- Keep credentials out of Git, browser code, public folders, screenshots and logs.

---

## 🧪 Automated Testing & Verification

### Main verification commands

```bash
npm run lint
npm run build
npm run test:all
```

### Individual test suites

| Command | Purpose |
|---|---|
| `npm run test:catalogue` | Catalogue import validation and dry-run checks |
| `npm run test:parity` | Database schema parity |
| `npm run test:admin` | Admin persistence and RLS error handling |
| `npm run test:security` | Admin RBAC and privilege-escalation protections |
| `npm run test:abuse` | Abuse prevention and rate-limit behavior |
| `npm run test:routes` | Application route and build checks |
| `npm run test:recovery` | Password recovery and session behavior |
| `npm run test:comm` | Communication validation and branded email renderer tests |
| `npm run test:booking` | Booking identifier resolution |
| `npm run test:supabase-project` | Production Supabase project guard |
| `npm run test:experiences-destinations` | Dynamic catalogue and destination behavior |
| `npm run test:audit-6-2` | Phase 6.2 dynamic data audit |
| `npm run test:staging-6-3` | Phase 6.3 staging and fallback checks |
| `npm run test:admin-ops-7` | Operations, departures, fleet and staff workflows |
| `npm run test:phase-8` | Finance and workflow validation |

GitHub Actions also runs dependency auditing, PWA asset validation, TypeScript and production build checks, communication/email renderer tests, project isolation checks, a clean local Supabase migration replay and pgTAP database security tests.

CI success does not prove that production credentials, live data, provider integrations or Hostinger deployment are correct. Complete the production acceptance checklist separately.

---

## 🚀 Production Build & Deployment

### Build and run

```bash
npm run build
npm start
```

The build performs two operations:

1. `vite build` compiles the React frontend into `dist/`.
2. `esbuild` bundles `server.ts` into the Node.js production entry point `server.js`.

The production start command is `npm start`, which runs `node server.js`.

### Hostinger deployment

1. Select **Node.js 22.x**.
2. Connect repository `sardeeena/Tours-system` and deploy branch `main`.
3. Configure the required environment variables in Hostinger.
4. Install dependencies with `npm install`.
5. Set the build command to `npm run build`.
6. Set the start command to `npm start`.
7. Ensure the application binds to the Hostinger-provided `PORT`.
8. Verify the exact deployed commit SHA and healthy Node.js process.
9. Smoke-test homepage, catalogue, tour details, availability, booking creation, customer account, admin login and required API routes.

> **Do not deploy as static-only hosting of `dist/`.** That omits the Express API and server-side application functionality.

See the [Hostinger deployment guide](./docs/guides/HOSTINGER_DEPLOYMENT_GUIDE.md) for the detailed operational procedure.

---

## 📋 Production Readiness & Owner Actions

The owner action checklist is the authoritative list of remaining manual acceptance tasks:

**[Open the full Owner Action Checklist](./docs/operations/OWNER_ACTION_CHECKLIST.md)**

The highest-priority items are:

- [ ] Enroll and verify TOTP MFA on the designated super-admin account, then confirm a fresh AAL2 session.
- [ ] Confirm real tour inventory, departures, availability, capacity, pickup fees and add-ons.
- [ ] Complete a full test booking and verify customer/admin views, totals, capacity and cancellation.
- [ ] Test production sign-in, role restrictions, password reset and recovery links.
- [ ] Verify Hostinger is running the intended `main` commit with Node.js 22.
- [ ] Verify Supabase Auth confirmation, recovery, invite and email-change messages through the configured SMTP provider.
- [ ] Verify Resend sender identity, webhook signature, delivery events and booking notification worker before enabling it.
- [ ] Verify newsletter subscribe, persistence, welcome email and unsubscribe flows.
- [ ] Re-run Supabase advisors and verify migrations, RLS, permissions and backups.
- [ ] Complete mobile/desktop, SEO, legal-page and public-route acceptance.
- [ ] Enable online payments only after provider, webhook, reconciliation and refund flows are verified.

A code merge or green CI pipeline does not complete owner-only tasks. Do not mark the platform fully production-ready until the checklist has evidence for the critical acceptance steps.

---

## 🔒 Security Guidelines

1. Never commit `.env`, API keys, passwords, access tokens, customer data or production database exports.
2. Never expose Supabase secret/service-role keys or provider tokens to frontend code.
3. Keep RLS enabled on exposed tables and test both allowed and denied access.
4. Use reviewed, incremental migrations for production database changes.
5. Back up before destructive data changes and confirm the target project before running SQL.
6. Restrict privileged database functions and validate caller permissions.
7. Keep optional integrations disabled until credentials, delivery paths and failure handling are tested.
8. Do not drop indexes solely to silence an advisor; evaluate query plans, foreign keys and workload first.
9. Do not claim a UI control or integration is operational without a successful end-to-end test.
10. Never use production customer details for acceptance testing.

---

## 📄 License

See the repository [LICENSE](./LICENSE) file for licensing terms.
