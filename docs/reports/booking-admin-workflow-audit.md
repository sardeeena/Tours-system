# Booking and admin workflow audit — remaining platform controls

This document records the controls reviewed alongside the booking-admin implementation.

## Addressed in this pull request

- Finance Manager manual payment authorization now uses the existing `finance.create` permission, which is granted by the Finance Manager's `finance.manage` role permission.
- Cancellation rejection requires a reason at both the admin UI and database RPC layers.
- Booking reads now fetch all pages in bounded batches instead of silently stopping at the PostgREST row cap. Errors are surfaced rather than represented as an empty booking list.
- Admin booking details include the passenger manifest (excluding passport/identity document numbers), full guest counts, pickup details and extras.
- Admin booking list has pagination over the complete filtered result set.
- Partial payment recording accepts an explicit amount and actual receipt/transaction reference; the database remains authoritative for the outstanding balance.
- Production migration-history reconciliation for the pickup RPC is included in this PR so clean migration replay and the recorded production versions agree.

## Deliberately not changed automatically

- **Supabase Auth leaked-password protection:** this is an Auth project configuration control, not a repository migration. It must be enabled and verified in the Supabase Auth settings for the production project. Do not claim it is enabled based on application code.
- **Unused-index advisories:** unused-index reports are workload-window dependent. Dropping indexes without checking query plans, constraints, and write/read patterns can degrade production. No index is dropped by this change.
- **RLS-enabled tables without policies:** PostgreSQL's default behavior is deny. The admin/operational tables with no policies are intentionally inaccessible to anon/authenticated direct table access and are reached through narrowly authorized server-side functions where required. Do not add permissive policies merely to silence an advisor.
- **SECURITY DEFINER RPCs:** authenticated EXECUTE grants are not by themselves proof of exposure. Each administrative RPC must retain an internal `has_permission` / `is_admin` guard, a pinned empty search_path, and appropriate role checks. This PR does not broadly revoke authenticated EXECUTE from the admin RPC surface because doing so would break the intended admin UI; regression checks cover the finance and cancellation paths touched here.

## Production safety

This pull request contains migrations and code only. It does not run booking/payment/refund RPCs against production, alter existing booking records, or change Auth dashboard settings. Production migration application and deployment require the normal release approval.
