BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(11);

SELECT ok(
  to_regclass('private.background_worker_leases') IS NOT NULL,
  'background worker lease table exists'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'private.background_worker_leases'::regclass),
  'background worker lease table has row-level security enabled'
);

SELECT ok(
  NOT has_table_privilege('anon', 'private.background_worker_leases', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'private.background_worker_leases', 'SELECT')
  AND NOT has_table_privilege('service_role', 'private.background_worker_leases', 'SELECT'),
  'worker lease rows are not directly readable through API roles'
);

SELECT ok(
  has_function_privilege('service_role', 'public.acquire_background_worker_lease(text,uuid,integer)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.acquire_background_worker_lease(text,uuid,integer)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.acquire_background_worker_lease(text,uuid,integer)', 'EXECUTE'),
  'only service_role can acquire worker leases'
);

SELECT ok(
  has_function_privilege('service_role', 'public.release_background_worker_lease(text,uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.release_background_worker_lease(text,uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.release_background_worker_lease(text,uuid)', 'EXECUTE'),
  'only service_role can release worker leases'
);

SET LOCAL ROLE service_role;

SELECT is(
  public.acquire_background_worker_lease('booking_notification', '11111111-1111-4111-8111-111111111111'::uuid, 90),
  TRUE,
  'first booking worker acquires the lease'
);

SELECT is(
  public.acquire_background_worker_lease('booking_notification', '22222222-2222-4222-8222-222222222222'::uuid, 90),
  FALSE,
  'a second booking worker cannot acquire an active lease'
);

SELECT is(
  public.acquire_background_worker_lease('booking_notification', '11111111-1111-4111-8111-111111111111'::uuid, 90),
  TRUE,
  'the lease owner can renew its own lease'
);

SELECT is(
  public.release_background_worker_lease('booking_notification', '11111111-1111-4111-8111-111111111111'::uuid),
  TRUE,
  'the current owner can release its lease'
);

SELECT is(
  public.acquire_background_worker_lease('booking_notification', '22222222-2222-4222-8222-222222222222'::uuid, 90),
  TRUE,
  'another process can acquire a released lease'
);

SELECT is(
  public.acquire_background_worker_lease('staff_notification', '33333333-3333-4333-8333-333333333333'::uuid, 90),
  TRUE,
  'booking and staff workers use independent leases'
);

SELECT * FROM finish();
ROLLBACK;
