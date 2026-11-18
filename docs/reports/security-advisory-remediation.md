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

Five exact duplicate non-unique indexes were confirmed and removed: the categories, destinations, tours, tour-availability (tour_id,date), and SEO lookup indexes duplicated equivalent unique constraint indexes. The unique constraint indexes remain intact and provide the same B-tree lookup keys. The remaining notices include primary-key/unique constraint indexes, foreign-key indexes, and low-volume operational indexes; no broad deletion is safe.

## Project Auth setting requiring dashboard access

Supabase leaked-password protection is an Auth project configuration setting, not a Postgres migration. The connected Supabase tools available for this task expose database and project inspection, but not the Auth configuration update/Management API operation. Do not attempt to change it through SQL or add an unsupported TOML key and assume production has changed.

Enable Authentication → Settings → Password security → Leaked password protection in the Supabase Dashboard for project uvtbtpxtrrmaublrztgv. Supabase documents availability on Pro plan and above:
https://supabase.com/docs/guides/auth/password-security

## Verification

The pgTAP regression suite in supabase/tests/security_advisory_remediation.test.sql verifies function execution boundaries, invoker/definer separation, RLS presence, restrictive deny policies, and browser-role table privileges. Production application behavior is not changed by the deny policies because browser roles already have no grants; service-role and guarded server-side routines retain their existing paths.
