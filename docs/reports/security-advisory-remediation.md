# Production security-advisory remediation review

Project scope: Awesome Adventure Tours (uvtbtpxtrrmaublrztgv) only.

## Remediated in this change

- scan_staff_notifications() is a server worker invoked with the production server's service-role Supabase client. Authenticated browser sessions do not call it. Execution is therefore revoked from PUBLIC, anon, and authenticated, and retained for service_role.
- upsert_departure_with_availability() remains the public RPC used by authenticated operations staff, but its wrapper now runs as SECURITY INVOKER. The private atomic implementation remains SECURITY DEFINER, pins an empty search path, and independently checks service_role or the live administrator authorization before writing.
- Eight tables were confirmed to have RLS enabled and no direct grants to anon or authenticated. Their access model is server-only. Restrictive deny policies now explicitly preserve that boundary and protect against a future permissive policy accidentally granting browser access:
  - content_translations
  - customer_communication_consent_events
  - technical_events
  - visitor_analytics_settings
  - visitor_consent_records
  - visitor_events
  - visitor_sessions
  - whatsapp_provider_status_events

## Findings deliberately not fixed by destructive changes

### 132 unused-index notices

The database statistics have been accumulating since 2026-11-03, but the advisory includes primary-key and unique indexes, including indexes that enforce identity and idempotency constraints. The unused list also includes foreign-key and operational indexes on low-volume tables. Dropping all indexes with zero scans would be unsafe and could break constraints, booking/finance queries, webhook deduplication, or future workloads.

One obvious duplicate candidate exists: public.categories_slug_key is a unique index on slug, while idx_categories_slug is a non-unique index on the same column. It should be reviewed against constraints and query plans before a separate, measured drop. No index is removed in this security migration.

## Project Auth setting requiring dashboard access

Supabase leaked-password protection is an Auth project configuration setting, not a Postgres migration. The connected Supabase tools available for this task expose database and project inspection, but not the Auth configuration update/Management API operation. Do not attempt to change it through SQL or add an unsupported TOML key and assume production has changed.

Enable Authentication → Settings → Password security → Leaked password protection in the Supabase Dashboard for project uvtbtpxtrrmaublrztgv. Supabase documents availability on Pro plan and above:
https://supabase.com/docs/guides/auth/password-security

## Verification

The pgTAP regression suite in supabase/tests/security_advisory_remediation.test.sql verifies function execution boundaries, invoker/definer separation, RLS presence, restrictive deny policies, and browser-role table privileges. Production application behavior is not changed by the deny policies because browser roles already have no grants; service-role and guarded server-side routines retain their existing paths.
