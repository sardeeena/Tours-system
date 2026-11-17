# Awesome Adventure Tours — Supabase operations guide

> **Current production reference.** This document replaces the obsolete Red Sea Excursions & Voyages / 33-table setup guide. Do not follow the legacy bootstrap, schema, seed, administrator-promotion, or manual SQL instructions from older copies of this document.

## Authoritative project

- Project reference: `uvtbtpxtrrmaublrztgv`
- Project URL: `https://uvtbtpxtrrmaublrztgv.supabase.co`
- Application repository: https://github.com/sardeeena/Tours-system
- Production domain: https://awesomeadventure.tours

Always verify the project reference in the Supabase dashboard before running SQL, migrations, or administrative actions. Never apply these instructions to another Supabase project.

## Database change workflow

1. Inspect the current schema and migration ledger before making changes.
2. Create a new forward-only migration in `supabase/migrations/`.
3. Never edit or replay an already-applied migration to change production state.
4. Preserve existing customer, booking, payment, invoice, review, and audit records.
5. Enable RLS on every newly exposed public-schema table and write least-privilege policies for the actual access model.
6. Treat every `SECURITY DEFINER` function as privileged code: restrict execution grants, validate caller identity and permissions, set a safe search path, and test both authorized and unauthorized callers.
7. Run the repository migration-history, project-boundary, security, booking, finance, and public-catalogue tests.
8. Run Supabase Security and Performance advisors after schema or policy changes.
9. Verify the migration ledger and production behavior after deployment.

## Production key handling

- Browser code may use only the publishable/anon key with RLS.
- `SUPABASE_SECRET_KEY` is server-only. Never prefix it with `VITE_`, expose it to the browser, commit it, or paste it into chat.
- Keep Resend, Gemini, WhatsApp, and payment-provider credentials in Hostinger server-side environment variables.
- Never upload a production `.env` file into a public web root or repository.

## Authentication and authorization

- Privileged administration requires the application's role checks and verified AAL2 session where enforced.
- Never authorize from user-editable Supabase `user_metadata`.
- Test ownership boundaries and denial paths, not just successful administrator access.
- Do not delete production Auth users as a generic cleanup step; user identities may be referenced by bookings, profiles, finance, audit, and storage records.

## Operational notes

The production database is larger than the legacy 33-table schema described in archived documentation. Use the live schema and current migrations as the source of truth; do not use old table counts or old seed SQL as a basis for changes.

For project-specific deployment configuration, use [the Hostinger deployment guide](./HOSTINGER_DEPLOYMENT_GUIDE.md). For administrator account lifecycle, use [the admin account guide](./ADMIN_ACCOUNT_LIFECYCLE.md).
