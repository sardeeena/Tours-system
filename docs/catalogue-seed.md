# Awesome Adventure Tours — Catalogue seed safety

This document supersedes the obsolete Kemet Spirit catalogue-seed instructions previously stored here.

## Production scope

- Authoritative application repository: https://github.com/sardeeena/Tours-system
- Production website: https://awesomeadventure.tours
- Authoritative Supabase project: `uvtbtpxtrrmaublrztgv`
- Production catalogue is already populated and managed through the current Awesome Adventure Tours admin workflows and versioned migrations.

## Safety rules

- Do not run any legacy Kemet Spirit seed, correction, import, or migration SQL against this project.
- Do not use historical seed files as a production reset or source of truth.
- Never truncate, delete, or overwrite live tours, bookings, customers, payments, invoices, or operational records as part of catalogue maintenance.
- Catalogue corrections must be narrowly scoped, reviewed, idempotent where possible, and accompanied by a forward-only migration or a controlled admin operation.
- Verify the target Supabase project ref before every database change. Stop if it is not `uvtbtpxtrrmaublrztgv`.

## Current workflow

1. Make catalogue changes through the Awesome Adventure Tours admin interface where supported.
2. For schema changes, add a new timestamped migration under `supabase/migrations/`; never edit an applied migration.
3. For data corrections, include exact row identifiers and old-value predicates, and add a verification query.
4. Run catalogue, public-discovery, migration-history, and project-boundary tests before opening a pull request.
5. Review the production result after deployment without exposing customer or payment data in logs or GitHub.

Historical seed artifacts are retained for audit history only. They are not instructions for the current production database.
