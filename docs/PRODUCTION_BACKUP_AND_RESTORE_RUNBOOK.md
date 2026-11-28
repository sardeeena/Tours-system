# Production Backup and Restore Runbook

Project: AwesomeAdventure (`uvtbtpxtrrmaublrztgv`)
Plan constraint: Supabase Free. Do not upgrade the project as part of this runbook.

## Backup requirements

A complete recoverable backup has two independent parts: PostgreSQL logical export (roles, schema, and data), and every object in every Supabase Storage bucket, including private buckets. Supabase Free projects do not receive scheduled daily database backups; Supabase recommends regular CLI exports and off-site storage. Database dumps do not include actual Storage object bytes.

## Database export

Use a trusted workstation or secured backup runner. Install the current Supabase CLI and Docker. Obtain the production database connection string from the Supabase Dashboard **Connect** panel (use the Session pooler where supported) and store it as `SUPABASE_DB_URL` in the secured runner. Never put credentials in Git, logs, shell history, or command output.

```bash
set -euo pipefail
umask 077
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="backups/$STAMP"
mkdir -p "$DEST"

: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL securely}"
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$DEST/roles.sql" --role-only
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$DEST/schema.sql"
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$DEST/data.sql" --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"

sha256sum "$DEST"/*.sql > "$DEST/SHA256SUMS"
```

The Supabase platform CLI backup workflow supports `--db-url` with the managed project's connection string. The database export includes database roles, schema, data, RLS policies, functions, triggers and Auth user records. Project-level Auth provider settings, JWT signing secrets, SMTP configuration, Edge Functions, and Storage object bytes/configuration require separate recovery steps.

Encrypt the export before uploading it. Store the encryption key separately from the backup destination. Use an off-site destination in a separate account/provider (for example, an encrypted S3-compatible bucket with versioning and lifecycle retention). Do not store backups in the application web root or in the same Supabase project being backed up.

Recommended initial policy: daily backups, retain 30 daily and 12 monthly copies, and alert on any failed or missing backup. Restrict access to the backup destination to the backup and recovery operators.

## Storage object export

The database dump is not a complete Storage backup and does not contain the actual object bytes. Treat Storage as a separate recovery component: export bucket configuration, object metadata and every object. Enumerate all buckets and recursively list every object (including nested prefixes), then download each object using the authenticated Supabase Storage API or an S3-compatible Storage endpoint. Preserve bucket, full object path, content type, cache-control, and relevant metadata. Include private buckets; do not make them public to facilitate backup.

Current buckets observed at the time of this runbook: `avatars` (public), `tour-media` (public), `support-ticket-attachments` (private), and `vouchers` (private). Re-enumerate buckets on every run; do not assume this list is permanent. Compare expected object count and total bytes with downloaded objects, produce a manifest with per-object SHA-256 hashes, and fail the backup if any object cannot be read. Upload the encrypted archive and manifest to the separate off-site destination.

## Restore drill (never restore over production for a test)

1. Provision an isolated recovery project or local Supabase stack; do not pause, reset, or overwrite production.
2. Restore roles, schema, and data using the official Supabase CLI restore procedure.
3. Recreate required project-level settings, secrets, Auth providers, SMTP, Edge Functions, and webhooks separately.
4. Restore Storage buckets and object bytes; preserve private/public bucket settings and object metadata.
5. Reapply and verify RLS, grants, functions, triggers, extensions, and migration history.
6. Compare row counts for bookings, payment transactions, refunds, profiles, tours, and content; compare bucket/object counts and checksums.
7. Run login, public catalogue, booking lookup, staff workflow, and payment reconciliation smoke tests against the isolated restore.
8. Record elapsed recovery time, data-loss window, failures, and sign-off. Never point production traffic at the restored environment without a separately approved cutover plan.

## Current operational state (2026-11-28)

- Supabase project is on Free; no automatic daily database backup is assumed.
- Storage has four buckets and 75 objects at the last metadata snapshot. Recheck before each backup.
- No off-site export, Storage archive, or restore rehearsal has yet been verified.
- This document is a runbook, not evidence that a backup exists.

## Acceptance criteria

- [ ] Database export succeeds on schedule and passes SHA-256 verification.
- [ ] All Storage objects are exported; manifest counts and checksums pass.
- [ ] Encrypted copies are stored outside Supabase and outside the production Hostinger web root.
- [ ] Retention and failure alerts are configured.
- [ ] A restore drill to an isolated environment passes.
- [ ] Recovery time and recovery point objectives are measured and documented.

## Official references

- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase CLI backup and restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
