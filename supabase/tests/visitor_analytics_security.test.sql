BEGIN;
SELECT plan(18);

SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.visitor_sessions'::regclass), 'visitor_sessions has RLS enabled');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.visitor_events'::regclass), 'visitor_events has RLS enabled');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.visitor_consent_records'::regclass), 'visitor_consent_records has RLS enabled');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.visitor_analytics_settings'::regclass), 'visitor_analytics_settings has RLS enabled');

SELECT ok(NOT has_table_privilege('anon', 'public.visitor_sessions', 'SELECT'), 'anon cannot read visitor sessions');
SELECT ok(NOT has_table_privilege('authenticated', 'public.visitor_sessions', 'SELECT'), 'authenticated users cannot read visitor sessions');
SELECT ok(NOT has_table_privilege('anon', 'public.visitor_events', 'SELECT'), 'anon cannot read visitor events');
SELECT ok(NOT has_table_privilege('authenticated', 'public.visitor_events', 'SELECT'), 'authenticated users cannot read visitor events');
SELECT ok(NOT has_table_privilege('anon', 'public.visitor_consent_records', 'SELECT'), 'anon cannot read consent history');
SELECT ok(NOT has_table_privilege('authenticated', 'public.visitor_consent_records', 'SELECT'), 'authenticated users cannot read consent history');

SELECT ok(has_table_privilege('service_role', 'public.visitor_sessions', 'INSERT'), 'server service role can write visitor sessions');
SELECT ok(has_table_privilege('service_role', 'public.visitor_events', 'INSERT'), 'server service role can write visitor events');

SELECT ok(NOT has_column('public', 'visitor_sessions', 'ip_address'), 'visitor sessions do not store raw IP addresses');
SELECT ok(NOT has_column('public', 'visitor_sessions', 'cookie_values'), 'visitor sessions do not store cookie values');
SELECT ok(NOT has_column('public', 'visitor_events', 'request_body'), 'visitor events do not store request bodies');
SELECT ok((SELECT pg_get_constraintdef(oid) LIKE '%auth_sign_in%' FROM pg_constraint WHERE conrelid = 'public.visitor_events'::regclass AND conname = 'visitor_events_event_name_check'), 'visitor event allowlist includes authentication audit events');

SELECT ok(has_column('public', 'visitor_analytics_settings', 'technical_event_retention_days'), 'technical event retention is configurable');
SELECT ok(has_column('public', 'visitor_analytics_settings', 'audit_log_retention_days'), 'business audit retention is configurable');

SELECT * FROM finish();
ROLLBACK;
