BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(20);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.customers'::regclass
      AND tgname = 'customers_protect_self_update_trigger'
      AND NOT tgisinternal
  ),
  'customer self-update protection trigger is installed'
);

SELECT ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']
   FROM pg_proc WHERE oid = 'private.protect_customer_self_update()'::regprocedure),
  'customer protection trigger is SECURITY DEFINER with an empty search_path'
);

SELECT ok(
  (SELECT position('total_revenue' IN pg_get_functiondef('private.protect_customer_self_update()'::regprocedure)) > 0
      AND position('outstanding_amount' IN pg_get_functiondef('private.protect_customer_self_update()'::regprocedure)) > 0
      AND position('user_id' IN pg_get_functiondef('private.protect_customer_self_update()'::regprocedure)) > 0),
  'customer CRM metrics, balances and ownership are protected'
);

SELECT ok(
  (SELECT position('confirmation_sent_at' IN pg_get_functiondef('public.protect_profile_role()'::regprocedure)) > 0
      AND position('is_confirmed' IN pg_get_functiondef('public.protect_profile_role()'::regprocedure)) > 0
      AND position('avatar_url' IN pg_get_functiondef('public.protect_profile_role()'::regprocedure)) > 0),
  'profile trigger protects trusted metadata while retaining approved profile fields'
);

SELECT ok(
  (SELECT provolatile = 'v' FROM pg_proc WHERE oid = 'private.get_tour_availability_schedule(text,date,date)'::regprocedure)
  AND (SELECT provolatile = 'v' AND NOT prosecdef FROM pg_proc WHERE oid = 'public.get_tour_availability_schedule(text,date,date)'::regprocedure),
  'availability implementation and invoker wrapper are VOLATILE for atomic rate limiting'
);

SELECT ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']
   FROM pg_proc WHERE oid = 'private.get_tour_availability_schedule(text,date,date)'::regprocedure)
  AND (SELECT NOT prosecdef FROM pg_proc WHERE oid = 'public.get_tour_availability_schedule(text,date,date)'::regprocedure),
  'availability SECURITY DEFINER implementation stays private and the public RPC remains invoker-rights'
);

SELECT ok(
  position('check_atomic_rate_limit' IN pg_get_functiondef('private.get_tour_availability_schedule(text,date,date)'::regprocedure)) > 0
  AND position('cf-connecting-ip' IN pg_get_functiondef('private.get_tour_availability_schedule(text,date,date)'::regprocedure)) > 0
  AND position('x-forwarded-for' IN pg_get_functiondef('private.get_tour_availability_schedule(text,date,date)'::regprocedure)) > 0,
  'public availability uses the existing atomic rate limiter with platform client IP headers'
);

SELECT ok(
  has_function_privilege('anon', 'public.get_tour_availability_schedule(text,date,date)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.get_tour_availability_schedule(text,date,date)', 'EXECUTE'),
  'anonymous and authenticated public availability access remains available'
);

SELECT ok(
  NOT has_function_privilege('anon', 'private.protect_customer_self_update()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'private.protect_customer_self_update()', 'EXECUTE'),
  'clients cannot invoke the private customer trigger function directly'
);

-- A minimal published tour is sufficient to exercise the public availability throttle.
INSERT INTO public.tours (id, title, slug, status, max_guests)
VALUES ('a9000000-0000-0000-0000-000000000011', 'Rate limit test', 'pgtap-availability-rate-limit', 'published', 12);

SET LOCAL request.jwt.claims = '{"role":"anon"}';
SET LOCAL request.jwt.claim.role = 'anon';
SET LOCAL request.headers = '{"cf-connecting-ip":"198.51.100.77"}';
SET LOCAL ROLE anon;

SELECT throws_ok(
  $$
  DO $test$
  BEGIN
    FOR i IN 1..61 LOOP
      PERFORM 1
      FROM public.get_tour_availability_schedule(
        'pgtap-availability-rate-limit',
        (now() AT TIME ZONE 'Africa/Cairo')::date,
        (now() AT TIME ZONE 'Africa/Cairo')::date
      );
    END LOOP;
  END;
  $test$;
  $$,
  'P0001',
  'Too many public availability requests. Please wait a moment and try again.',
  'anonymous availability requests are atomically limited per client IP'
);

RESET ROLE;
SET LOCAL request.headers = '{}';
SET LOCAL request.jwt.claims = '{}';
SET LOCAL request.jwt.claim.sub = '';

-- Customer/profile behavioral tests use isolated Auth users and rows; the file rolls back.
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES (
  'f9000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'pgtap-customer@example.test', '',
  now(), '{}'::jsonb, '{}'::jsonb, now(), now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, full_name, role, is_confirmed)
VALUES (
  'f9000000-0000-0000-0000-000000000001',
  'pgtap-customer@example.test', 'PgTAP Customer', 'customer', false
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES (
  'f9000000-0000-0000-0000-000000000002',
  'authenticated', 'authenticated', 'pgtap-admin@example.test', '',
  now(), '{}'::jsonb, '{}'::jsonb, now(), now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, full_name, role, is_confirmed)
VALUES (
  'f9000000-0000-0000-0000-000000000002',
  'pgtap-admin@example.test', 'PgTAP Admin', 'customer', false
)
ON CONFLICT (id) DO NOTHING;

-- The test connection is postgres, so the explicit target-bound nonce is required.
SELECT set_config('app.admin_provisioning_nonce', 'pgtap-authorized-admin-seed', true);
SELECT set_config('app.admin_provisioning_active_user', 'f9000000-0000-0000-0000-000000000002', true);
UPDATE public.profiles
SET role = 'admin', is_confirmed = TRUE
WHERE id = 'f9000000-0000-0000-0000-000000000002';
SELECT set_config('app.admin_provisioning_nonce', '', true);
SELECT set_config('app.admin_provisioning_active_user', '', true);
SET LOCAL request.jwt.claims = '{}';
SET LOCAL request.jwt.claim.role = 'authenticated';

INSERT INTO public.customers (
  id, user_id, first_name, last_name, email, phone, country, total_revenue, outstanding_amount
)
VALUES (
  'f9000000-0000-0000-0000-000000000101',
  'f9000000-0000-0000-0000-000000000001',
  'PgTAP', 'Customer', 'pgtap-customer@example.test', '+201000000001', 'Egypt', 0, 0
)
ON CONFLICT (id) DO NOTHING;

SET LOCAL request.jwt.claims = '{"sub":"f9000000-0000-0000-0000-000000000001","role":"authenticated","aud":"authenticated"}';
SET LOCAL request.jwt.claim.sub = 'f9000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;

UPDATE public.customers
SET first_name = 'Updated'
WHERE id = 'f9000000-0000-0000-0000-000000000101';

SELECT is(
  (SELECT first_name FROM public.customers WHERE id = 'f9000000-0000-0000-0000-000000000101'),
  'Updated',
  'customer can update an approved contact field on their own record'
);

SELECT throws_ok(
  $$UPDATE public.customers SET total_revenue = 999 WHERE id = 'f9000000-0000-0000-0000-000000000101'$$,
  '42501',
  'Customers may only update their contact details and preferences. CRM and booking-derived fields are protected.',
  'customer cannot change CRM revenue'
);

SELECT throws_ok(
  $UPDATE public.customers SET user_id = 'f9000000-0000-0000-0000-000000000002' WHERE id = 'f9000000-0000-0000-0000-000000000101'$,
  '42501',
  'Customers may only update their contact details and preferences. CRM and booking-derived fields are protected.',
  'customer cannot reassign customer record ownership'
);

SELECT throws_ok(
  $UPDATE public.customers SET status = 'vip', notes = 'forged', total_bookings_count = 99 WHERE id = 'f9000000-0000-0000-0000-000000000101'$,
  '42501',
  'Customers may only update their contact details and preferences. CRM and booking-derived fields are protected.',
  'customer cannot alter CRM status, notes or booking counters'
);

UPDATE public.profiles
SET full_name = 'Updated Customer Name'
WHERE id = 'f9000000-0000-0000-0000-000000000001';

SELECT is(
  (SELECT full_name FROM public.profiles WHERE id = 'f9000000-0000-0000-0000-000000000001'),
  'Updated Customer Name',
  'customer can update their permitted profile name'
);

SELECT throws_ok(
  $$UPDATE public.profiles SET email = 'attacker@example.test' WHERE id = 'f9000000-0000-0000-0000-000000000001'$$,
  '42501',
  'Profile email, role, confirmation and server-managed fields cannot be changed directly.',
  'customer cannot change trusted profile email'
);

SELECT throws_ok(
  $$UPDATE public.profiles SET is_confirmed = TRUE WHERE id = 'f9000000-0000-0000-0000-000000000001'$$,
  '42501',
  'Profile email, role, confirmation and server-managed fields cannot be changed directly.',
  'customer cannot self-confirm their profile'
);

UPDATE public.profiles
SET role = 'super_admin'
WHERE id = 'f9000000-0000-0000-0000-000000000001';

SELECT is(
  (SELECT role FROM public.profiles WHERE id = 'f9000000-0000-0000-0000-000000000001'),
  'customer',
  'customer cannot promote their own profile to super_admin'
);

RESET ROLE;
SET LOCAL request.jwt.claims = '{"sub":"f9000000-0000-0000-0000-000000000002","role":"authenticated","aud":"authenticated"}';
SET LOCAL request.jwt.claim.sub = 'f9000000-0000-0000-0000-000000000002';
SET LOCAL ROLE authenticated;

UPDATE public.customers
SET total_revenue = 123.45
WHERE id = 'f9000000-0000-0000-0000-000000000101';

SELECT is(
  (SELECT total_revenue FROM public.customers WHERE id = 'f9000000-0000-0000-0000-000000000101'),
  123.45::numeric,
  'verified administrator retains CRM metric management'
);

RESET ROLE;
SET LOCAL request.jwt.claims = '{"role":"service_role"}';
SET LOCAL request.jwt.claim.role = 'service_role';
SET LOCAL ROLE service_role;

UPDATE public.customers
SET outstanding_amount = 55.00
WHERE id = 'f9000000-0000-0000-0000-000000000101';

SELECT is(
  (SELECT outstanding_amount FROM public.customers WHERE id = 'f9000000-0000-0000-0000-000000000101'),
  55.00::numeric,
  'service_role retains trusted CRM management'
);

SELECT * FROM finish();
ROLLBACK;
