BEGIN;
SELECT plan(20);

SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.audit_logs'::regclass), 'audit_logs has RLS enabled');
SELECT ok(NOT has_table_privilege('anon', 'public.audit_logs', 'SELECT'), 'anon cannot read audit logs');
SELECT ok(NOT has_table_privilege('authenticated', 'public.audit_logs', 'SELECT'), 'authenticated users cannot read audit logs');
SELECT ok(has_table_privilege('service_role', 'public.audit_logs', 'SELECT'), 'server service role can read audit logs');
SELECT ok(NOT has_table_privilege('anon', 'public.audit_logs', 'INSERT'), 'anon cannot insert audit logs');
SELECT ok(NOT has_table_privilege('authenticated', 'public.audit_logs', 'INSERT'), 'authenticated users cannot insert audit logs');
SELECT ok(NOT has_table_privilege('anon', 'public.audit_logs', 'DELETE'), 'anon cannot delete audit logs');
SELECT ok(NOT has_table_privilege('authenticated', 'public.audit_logs', 'UPDATE'), 'authenticated users cannot update audit logs');

SELECT ok(EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'private' AND p.proname = 'capture_business_audit' AND p.prosecdef
), 'business audit trigger function is isolated and security definer');

SELECT ok(EXISTS (
  SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  WHERE c.oid = 'public.bookings'::regclass AND t.tgname = 'trg_capture_business_audit' AND NOT t.tgisinternal
), 'booking updates and deletes are audited');

SELECT ok(EXISTS (
  SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  WHERE c.oid = 'public.tours'::regclass AND t.tgname = 'trg_capture_business_audit' AND NOT t.tgisinternal
), 'tour catalogue changes are audited');

SELECT ok(EXISTS (
  SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  WHERE c.oid = 'public.profiles'::regclass AND t.tgname = 'trg_capture_business_audit' AND NOT t.tgisinternal
), 'profile changes are audited');

SELECT ok(EXISTS (
  SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  WHERE c.oid = 'public.support_tickets'::regclass AND t.tgname = 'trg_capture_business_audit' AND NOT t.tgisinternal
), 'support ticket changes are audited');

SELECT ok(EXISTS (
  SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  WHERE c.oid = 'public.payment_transactions'::regclass AND t.tgname = 'trg_capture_business_audit' AND NOT t.tgisinternal
), 'payment transaction changes are audited');

SELECT ok(NOT has_function_privilege('anon', 'private.capture_business_audit()', 'EXECUTE'), 'anon cannot invoke the audit trigger function directly');
SELECT ok(NOT has_function_privilege('authenticated', 'private.capture_business_audit()', 'EXECUTE'), 'authenticated users cannot invoke the audit trigger function directly');

SELECT ok(NOT EXISTS (
  SELECT 1 FROM pg_tables p
  WHERE p.schemaname = 'public'
    AND p.tablename NOT IN (
      'audit_logs','technical_events','visitor_sessions','visitor_events',
      'visitor_consent_records','visitor_analytics_settings',
      'rate_limit_events','rate_limit_buckets','request_idempotency',
      'idempotency_keys','booking_idempotency_keys','schema_migrations'
    )
    AND NOT EXISTS (
      SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relname = p.tablename AND t.tgname = 'trg_capture_business_audit' AND NOT t.tgisinternal
    )
), 'all public business tables have row-change audit triggers');

CREATE TEMP TABLE audit_redaction_probe (id uuid, email text, status text, metadata jsonb);
CREATE TRIGGER trg_capture_business_audit_probe
  AFTER INSERT OR UPDATE OR DELETE ON pg_temp.audit_redaction_probe
  FOR EACH ROW EXECUTE FUNCTION private.capture_business_audit();
INSERT INTO pg_temp.audit_redaction_probe (id, email, status, metadata)
VALUES (gen_random_uuid(), 'private@example.invalid', 'active', '{"private":"do not retain"}'::jsonb);
SELECT ok(EXISTS (
  SELECT 1 FROM public.audit_logs
  WHERE entity_type = 'audit_redaction_probe'
    AND new_data ? 'status'
    AND NOT (new_data ? 'email')
    AND NOT (new_data ? 'metadata')
), 'audit snapshots retain safe status fields and redact contact and JSON metadata');

SELECT ok(has_function_privilege('service_role', 'public.erase_visitor_analytics(text,uuid,uuid)', 'EXECUTE'), 'server service role can execute atomic analytics erasure');
SELECT ok(NOT has_function_privilege('authenticated', 'public.erase_visitor_analytics(text,uuid,uuid)', 'EXECUTE'), 'authenticated users cannot execute analytics erasure directly');

SELECT * FROM finish();
ROLLBACK;
