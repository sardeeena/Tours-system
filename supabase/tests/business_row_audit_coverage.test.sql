BEGIN;
SELECT plan(12);

SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.audit_logs'::regclass), 'audit_logs has RLS enabled');
SELECT ok(NOT has_table_privilege('anon', 'public.audit_logs', 'SELECT'), 'anon cannot read audit logs');
SELECT ok(NOT has_table_privilege('authenticated', 'public.audit_logs', 'SELECT'), 'authenticated users cannot read audit logs');
SELECT ok(has_table_privilege('service_role', 'public.audit_logs', 'SELECT'), 'server service role can read audit logs');

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

SELECT * FROM finish();
ROLLBACK;
