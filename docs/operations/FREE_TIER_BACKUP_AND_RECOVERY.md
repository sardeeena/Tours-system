# Supabase Free-Tier Backup and Recovery Runbook

**Scope:** Awesome Adventure Tours production only  
**Supabase project ref:** `uvtbtpxtrrmaublrztgv`  
**Website:** `https://awesomeadventure.tours`  
**Policy:** Keep the Supabase organization on the Free plan. Do not upgrade, change billing, or run a production restore without owner approval.

## 1. What the Free plan does and does not provide

Supabase Free does not provide automatic daily database backups or downloadable platform-managed backups. Supabase recommends that Free projects regularly export their data with the Supabase CLI and keep off-site copies.

A logical `supabase db dump` is not a complete project image:

- The CLI excludes Supabase-managed schemas such as `auth` and `storage` by default.
- Database dumps do not contain the actual files stored through the Storage API.
- Project configuration, Auth provider settings, API keys, Edge Functions, webhooks, secrets, and other dashboard settings must be documented or exported separately.
- A logical dump is not Point-in-Time Recovery. Recovery can only return to the latest usable export, so changes after that export may be lost.

**Do not describe this process as equivalent to Supabase paid-plan backups or PITR.**

Official references:
- [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Supabase Storage object downloads](https://supabase.com/docs/guides/storage/management/download-objects)

## 2. Minimum backup schedule

| When | Required action |
|---|---|
| Daily, before business activity where practical | Export the database schema/data and store the encrypted files off-site |
| Before every production migration or data correction | Create a fresh export and verify the files before proceeding |
| Immediately after a successful migration | Create a second export and record the deployed commit/migration versions |
| After Storage uploads or changes | Export/download changed objects and update the bucket inventory |
| Monthly | Perform a restore rehearsal into a separate, disposable Supabase project |

For a busy booking operation, a daily export is the minimum practical target. The Recovery Point Objective is the time elapsed since the last verified export; it is not zero.

Keep at least 7 daily and 4 weekly encrypted backup sets where storage capacity permits. Keep the backup location separate from both Supabase and the Hostinger hosting account.

## 3. Database export procedure

### Prerequisites

1. Use a trusted workstation with the Supabase CLI, Docker, and PostgreSQL client tools installed.
2. Verify the CLI version with `supabase --version`.
3. In Supabase Dashboard, open the AwesomeAdventure project and use **Connect** to obtain the database connection string. Prefer the direct connection when the network supports IPv6; otherwise use the Session pooler connection string.
4. Keep the database password in a password manager or a temporary protected environment variable. Never paste it into ChatGPT, a ticket, a repository, a workflow log, or a shared document.
5. Confirm the target is project `uvtbtpxtrrmaublrztgv` before running any command.

### Export

From the trusted workstation, link the CLI to the exact production project. The CLI will prompt for the database password; enter it interactively and do not place it in shell history or a command argument:

```bash
supabase link --project-ref uvtbtpxtrrmaublrztgv
```

Then create the export set. These commands use the linked project (the default target for `supabase db dump`):

```bash
mkdir -p ./awesome-adventure-backup
cd ./awesome-adventure-backup

supabase db dump -f roles.sql --role-only
supabase db dump -f schema.sql
supabase db dump -f data.sql --use-copy --data-only \
  -x "storage.buckets_vectors" \
  -x "storage.vector_indexes"

sha256sum roles.sql schema.sql data.sql > SHA256SUMS
```

Do not add a `--remote` flag or put the database password in the command. For a self-hosted PostgreSQL instance, the CLI supports `--db-url`; for this hosted Supabase project, use `supabase link` and the linked-project workflow.

The CLI's default dump excludes Supabase-managed schemas and extension-owned schemas. The three files cover custom roles, application schema, and application data; they do not export Auth users or Storage object bytes.

### Verify and protect the export

- Confirm all three SQL files exist and are non-empty.
- Review the CLI output for errors and confirm it targeted the expected project.
- Run `sha256sum -c SHA256SUMS`.
- Compress and encrypt the backup set before off-site transfer.
- Upload it to an owner-controlled, encrypted storage location outside Supabase and Hostinger.
- Keep the checksum file with the encrypted archive.
- Record the export timestamp, source project ref, repository commit, migration count, and operator in a backup register.
- Never commit SQL exports, customer data, connection strings, passwords, API keys, or decrypted archives to Git.

A checksum proves file integrity, not restoreability. A backup is not verified until a restore rehearsal succeeds.

## 4. Storage object backup

Database exports do not contain Storage object bytes and do not preserve a complete Storage configuration.

For every bucket:

1. Record the bucket name, public/private setting, allowed MIME types, file-size limit, and relevant access policies.
2. Download all objects while preserving their bucket and object paths. Use the Supabase Dashboard for small buckets, or the S3-compatible Storage endpoint with a trusted client such as rclone for bulk exports.
3. Store the files in the same encrypted off-site backup set, or in a separate encrypted archive with a matching checksum manifest.
4. Record object counts and total bytes, then compare them with the downloaded archive.
5. Keep the bucket configuration and policy definitions with the recovery documentation.

Do not make a private bucket public to simplify backup. Do not place private customer documents in a public archive.

## 5. Configuration inventory

Maintain a protected, non-secret inventory of:

- Project ref, region, PostgreSQL version, enabled extensions, and migration count.
- Auth providers, redirect URLs, email settings, MFA requirements, and session policies.
- Storage bucket names, visibility, upload restrictions, and policies.
- Edge Function names and deployment versions.
- Database webhooks, scheduled jobs, Realtime publications, and external integrations.
- Hostinger Node.js version, build settings, domain, SSL/CDN state, and deployment commit.
- Names of required environment variables and their owning service, but never their values.

Secrets must remain in the appropriate secret manager. This inventory must not contain database passwords, Supabase secret/service-role keys, Resend keys, Gemini keys, Meta credentials, or webhook secrets.

## 6. Restore rehearsal — never restore over production

A restore test must use a separate disposable Supabase project. Do not point restore commands at the live AwesomeAdventure project.

1. Create a temporary Supabase project and configure the required PostgreSQL extensions.
2. Use the matching PostgreSQL client/CLI version.
3. Review the official Supabase restore instructions and the exported SQL before execution.
4. Restore the custom roles, schema, and application data into the temporary project using the documented `psql` procedure.
5. Recreate Auth settings/users and Storage buckets, policies, and objects using the separately maintained configuration and exports. The logical dump does not perform these steps.
6. Verify table counts, key constraints, RLS/policies, functions, triggers, sequences, and representative booking/customer/payment relationships.
7. Verify Storage object counts and sample file checksums.
8. Run application smoke tests against the temporary project only.
9. Record failures, recovery duration, and any manual reconfiguration required.
10. Delete the disposable project only after the test evidence is saved and the owner approves deletion.

Never test a restore by truncating, dropping, or replacing production tables.

## 7. Release gate

Before any production migration, schema change, bulk content import, or data correction:

- [ ] A fresh database export exists.
- [ ] SQL files are non-empty and checksums pass.
- [ ] The encrypted off-site copy is accessible.
- [ ] Storage changes are included or explicitly confirmed unchanged.
- [ ] The exact migration/deployment commit is recorded.
- [ ] A rollback or recovery plan is documented.
- [ ] The owner approves the production change.

If a verified backup cannot be produced, stop the production data-changing operation. Continue only with read-only checks or changes isolated to a reviewed Git branch.

## 8. Backup register template

| Field | Value |
|---|---|
| Export date/time (UTC) | |
| Source project ref | `uvtbtpxtrrmaublrztgv` |
| Repository commit | |
| Applied migration count | |
| Database archive location | |
| Storage archive location | |
| SHA-256 verification | Pass / Fail |
| Restore rehearsal date | |
| Restore rehearsal result | Pass / Fail / Not run |
| Operator | |
| Notes / exceptions | |

**Current state:** this runbook documents the Free-tier process. It does not claim that a fresh export has been taken, stored off-site, or successfully restored. Those are separate operational evidence items.
