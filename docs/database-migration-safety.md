# Database migration safety

## Current source-of-truth rules

- Incremental schema changes belong in `supabase/migrations/`.
- Every migration filename must use a unique UTC timestamp in the form `YYYYMMDDHHMMSS_snake_case.sql`.
- `supabase/config.toml` must identify the Awesome Adventure Tours project ref: `uvtbtpxtrrmaublrztgv`.
- CI starts an isolated local Supabase stack, applies the repository migrations to that local database, and runs database tests. This is not a production migration deployment.

## Read-only comparison with the hosted project

Use Supabase CLI v3 or newer and authenticate with an account that can inspect the project. From the repository root, run:

```sh
supabase migration list --remote
```

This lists local and hosted migration history for the project configured in `supabase/config.toml`. Review both columns and compare the version identifiers before proposing any correction.

If the command cannot connect, stop and resolve authentication or connection setup first. Do not try a reset or push as a diagnostic workaround.

## If histories differ

1. Stop before applying, reverting, repairing, or resetting anything.
2. Capture the complete local and remote migration lists.
3. Identify each missing or unexpected version and inspect the corresponding SQL file and the actual database schema.
4. Determine whether the schema change was applied manually, the migration file is missing, or the tracking record is inaccurate.
5. Prepare a separate reviewed change with evidence and a rollback plan.

**Never run `supabase migration repair`, `supabase db reset`, `supabase db push`, or any migration mutation command merely to make a warning disappear.** A history repair changes tracking metadata; it does not prove that the SQL change exists or is correct. Production history must not be rewritten without an explicit, evidence-based decision and approval.

## What CI verifies

The migration-history guard checks that:
- the configured project ref is the approved Awesome Adventure Tours project;
- the migrations directory contains only SQL migration files;
- every filename has a valid timestamp and snake_case name;
- timestamps are unique and strictly increasing;
- migration files are non-empty.

The local database job then applies the complete migration set to a fresh local database and runs the database tests. These checks validate repository consistency and clean-build behavior; they do not claim that the hosted schema is identical to the repository.
