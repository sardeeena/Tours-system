BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(12);

SELECT ok(NOT has_function_privilege('authenticated','public.scan_staff_notifications()','EXECUTE'),
  'authenticated users cannot execute the server-only staff notification scanner');
SELECT ok(has_function_privilege('service_role','public.scan_staff_notifications()','EXECUTE'),
  'the server worker service role can execute the staff notification scanner');
SELECT ok(NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.upsert_departure_with_availability(uuid,uuid,date,text,text,integer,text,uuid,uuid,uuid,text)'::regprocedure),
  'public departure RPC runs as SECURITY INVOKER');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid='private.upsert_departure_with_availability(uuid,uuid,date,text,text,integer,text,uuid,uuid,uuid,text)'::regprocedure),
  'private departure implementation retains its guarded SECURITY DEFINER transaction');
SELECT ok(
  has_function_privilege('authenticated','public.upsert_departure_with_availability(uuid,uuid,date,text,text,integer,text,uuid,uuid,uuid,text)','EXECUTE')
  AND NOT has_function_privilege('anon','public.upsert_departure_with_availability(uuid,uuid,date,text,text,integer,text,uuid,uuid,uuid,text)','EXECUTE'),
  'only authenticated callers can reach the public departure wrapper');
SELECT is(
  (SELECT count(*)::integer FROM pg_policies
   WHERE schemaname='public'
     AND tablename IN ('content_translations','customer_communication_consent_events','technical_events','visitor_analytics_settings','visitor_consent_records','visitor_events','visitor_sessions','whatsapp_provider_status_events')
     AND policyname LIKE 'deny_api_roles_%'
     AND permissive='RESTRICTIVE'),
  8, 'all eight server-only tables have restrictive deny policies');
SELECT is(
  (SELECT count(*)::integer FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public'
     AND c.relname IN ('content_translations','customer_communication_consent_events','technical_events','visitor_analytics_settings','visitor_consent_records','visitor_events','visitor_sessions','whatsapp_provider_status_events')
     AND c.relrowsecurity),
  8, 'RLS remains enabled on all eight server-only tables');
SELECT ok(NOT has_table_privilege('anon','public.content_translations','SELECT') AND NOT has_table_privilege('authenticated','public.content_translations','SELECT'), 'content translations remain unreadable directly from browser roles');
SELECT ok(NOT has_table_privilege('anon','public.customer_communication_consent_events','SELECT') AND NOT has_table_privilege('authenticated','public.customer_communication_consent_events','SELECT'), 'communication consent history remains unreadable directly from browser roles');
SELECT ok(NOT has_table_privilege('anon','public.technical_events','SELECT') AND NOT has_table_privilege('authenticated','public.technical_events','SELECT'), 'technical telemetry remains unreadable directly from browser roles');
SELECT ok(NOT has_table_privilege('anon','public.visitor_analytics_settings','SELECT') AND NOT has_table_privilege('authenticated','public.visitor_analytics_settings','SELECT'), 'visitor analytics settings remain unreadable directly from browser roles');
SELECT ok(NOT has_table_privilege('anon','public.visitor_consent_records','SELECT') AND NOT has_table_privilege('authenticated','public.visitor_consent_records','SELECT'), 'visitor consent records remain unreadable directly from browser roles');

SELECT * FROM finish();
ROLLBACK;
