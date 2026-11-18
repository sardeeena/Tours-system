BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(6);

SELECT has_function(
  'public','scan_staff_notifications',ARRAY[]::text[],
  'durable staff notification scanner RPC exists'
);

SELECT ok(
  NOT has_function_privilege('anon','public.scan_staff_notifications()','EXECUTE'),
  'anonymous callers cannot invoke the notification scanner'
);

SELECT ok(
  NOT has_function_privilege('authenticated','public.scan_staff_notifications()','EXECUTE'),
  'authenticated users cannot invoke the server-only scanner'
);

SELECT ok(
  has_function_privilege('service_role','public.scan_staff_notifications()','EXECUTE'),
  'the server worker service role can invoke the scanner'
);

SELECT ok(
  position('new_payment' in (
    SELECT pg_get_constraintdef(oid)
    FROM pg_constraint
    WHERE conrelid='public.staff_notifications'::regclass
      AND conname='staff_notifications_category_check'
  )) > 0,
  'staff notification category constraint includes the payment category'
);

SELECT ok(
  position('departure_unassigned' in (
    SELECT pg_get_constraintdef(oid)
    FROM pg_constraint
    WHERE conrelid='public.staff_notifications'::regclass
      AND conname='staff_notifications_category_check'
  )) > 0,
  'staff notification category constraint includes operational categories'
);

SELECT * FROM finish();
ROLLBACK;
