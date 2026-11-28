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

## Automated GitHub Actions backup

The repository includes a daily `Supabase off-site backup` workflow. It creates database exports, Storage bucket configuration, Storage RLS policy definitions, all Storage objects (including private buckets), and a SHA-256 manifest. It compresses the export, encrypts it client-side with `age`, uploads the encrypted archive to an S3-compatible destination, and verifies the remote object size with a HEAD request. It also creates a separate monthly copy on the first day of each month.

The workflow is deliberately inactive until the destination and credentials are configured. Scheduled runs with missing configuration report a warning and do not claim a backup was created; a manual run fails clearly until configuration is complete.

### GitHub Actions secrets

Add these under **Repository Settings → Secrets and variables → Actions → Secrets**. Never paste them into chat or commit them:

- `SUPABASE_DB_URL`: the production database connection string from Supabase Dashboard → Connect.
- `SUPABASE_SECRET_KEY`: the project's server/service-role secret key.
- `BACKUP_S3_ACCESS_KEY_ID`: the bucket-scoped S3-compatible access key.
- `BACKUP_S3_SECRET_ACCESS_KEY`: the corresponding secret key.

### GitHub Actions variables

Add these under **Repository Settings → Secrets and variables → Actions → Variables**:

- `BACKUP_S3_ENDPOINT`: the provider's S3 endpoint. For Cloudflare R2 use `https://<account-id>.r2.cloudflarestorage.com`; for AWS S3 use `https://s3.<region>.amazonaws.com`.
- `BACKUP_S3_BUCKET`: the private backup bucket name.
- `BACKUP_S3_REGION`: use `auto` for Cloudflare R2 or the AWS bucket region for S3.
- `BACKUP_AGE_RECIPIENT`: the public `age1...` recipient string. Keep the matching private key offline in a password manager or other separate secure location.

Generate an encryption key pair on a trusted workstation with `age-keygen -o backup-age-key.txt`. Store the private key line beginning `AGE-SECRET-KEY-` offline; copy only the public recipient line beginning `age1` into the GitHub variable. Never upload the private key to GitHub.

### Bucket security and retention

- Keep the bucket private and block public access.
- Enable bucket versioning where supported.
- Scope the access key to this bucket and the `backups/*` prefix only; grant only the object upload/read/head permissions required by the workflow.
- Configure lifecycle expiration for `backups/daily/` after 30 days and `backups/monthly/` after 365 days. The workflow creates the monthly copies; the bucket lifecycle enforces retention.
- Do not grant the backup key permission to delete source data in Supabase.

After adding the secrets and variables, run **Actions → Supabase off-site backup → Run workflow** once. Confirm the workflow summary reports a verified remote upload and the object exists in the private bucket. The first successful upload is not a restore test; complete the isolated restore drill below before treating recovery as proven.


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
- Storage currently has four buckets and 78 objects totaling 37,280,388 bytes (about 37.28 MB) as of 2026-11-28. Re-enumerate on every backup; this snapshot is not a permanent inventory.
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
