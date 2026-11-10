BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(17);

INSERT INTO public.tours (id, title, slug, status, max_guests)
VALUES
  ('a9000000-0000-0000-0000-000000000001', 'Published availability test', 'pgtap-availability-published', 'published', 12),
  ('a9000000-0000-0000-0000-000000000002', 'Draft availability test', 'pgtap-availability-draft', 'draft', 12),
  ('a9000000-0000-0000-0000-000000000003', 'Archived availability test', 'pgtap-availability-archived', 'archived', 12);

INSERT INTO public.tour_availability (tour_id, date, status, max_capacity, booked_count, notes)
VALUES ('a9000000-0000-0000-0000-000000000001', (now() AT TIME ZONE 'Africa/Cairo')::date, 'available', 12, 0, 'Internal operations note must not be public');

SET LOCAL request.jwt.claim.sub = '';
SET LOCAL request.jwt.claims = '{}';

SELECT ok(
  to_regprocedure('public.get_tour_availability_schedule(text,date,date)') IS NOT NULL,
  'bounded tour availability RPC exists'
);

SELECT ok(
  has_function_privilege('anon', 'public.get_tour_availability_schedule(text,date,date)', 'EXECUTE'),
  'anonymous guests retain access to the public availability RPC'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.get_tour_availability_schedule(text,date,date)', 'EXECUTE'),
  'authenticated users retain access to the availability RPC'
);

SELECT ok(
  (SELECT prosecdef FROM pg_proc WHERE oid = 'public.get_tour_availability_schedule(text,date,date)'::regprocedure),
  'availability RPC remains SECURITY DEFINER'
);

SELECT ok(
  (SELECT proconfig @> ARRAY['search_path=""'] FROM pg_proc WHERE oid = 'public.get_tour_availability_schedule(text,date,date)'::regprocedure),
  'availability RPC uses an empty search_path and schema-qualified objects'
);

SELECT is(
  (SELECT count(*)::int FROM public.get_tour_availability_schedule('pgtap-availability-published', (now() AT TIME ZONE 'Africa/Cairo')::date, (now() AT TIME ZONE 'Africa/Cairo')::date)),
  1,
  'anonymous availability lookup returns a published tour'
);

SELECT is(
  (SELECT count(*)::int FROM public.get_tour_availability_schedule('pgtap-availability-draft', (now() AT TIME ZONE 'Africa/Cairo')::date, (now() AT TIME ZONE 'Africa/Cairo')::date)),
  0,
  'anonymous availability lookup hides draft tours'
);

SELECT is(
  (SELECT count(*)::int FROM public.get_tour_availability_schedule('pgtap-availability-archived', (now() AT TIME ZONE 'Africa/Cairo')::date, (now() AT TIME ZONE 'Africa/Cairo')::date)),
  0,
  'anonymous availability lookup hides archived tours'
);

SELECT is(
  (SELECT notes FROM public.get_tour_availability_schedule('pgtap-availability-published', (now() AT TIME ZONE 'Africa/Cairo')::date, (now() AT TIME ZONE 'Africa/Cairo')::date)),
  NULL::text,
  'anonymous availability lookup never exposes internal operational notes'
);

SELECT is(
  (SELECT count(*)::int FROM public.get_tour_availability_schedule('pgtap-availability-published', (now() AT TIME ZONE 'Africa/Cairo')::date, (now() AT TIME ZONE 'Africa/Cairo')::date + 365)),
  366,
  'the maximum supported date range contains 366 calendar days'
);

SELECT throws_ok(
  $query$SELECT * FROM public.get_tour_availability_schedule('pgtap-availability-published', (now() AT TIME ZONE 'Africa/Cairo')::date, (now() AT TIME ZONE 'Africa/Cairo')::date + 366)$query$,
  '22023',
  'Availability date range cannot exceed 366 days',
  'availability RPC rejects date ranges longer than 366 days'
);

SELECT throws_ok(
  $query$SELECT * FROM public.get_tour_availability_schedule('pgtap-availability-published', (now() AT TIME ZONE 'Africa/Cairo')::date - 1, (now() AT TIME ZONE 'Africa/Cairo')::date - 1)$query$,
  '22023',
  'Public availability lookup cannot include past dates',
  'anonymous availability lookup cannot disclose historical booking capacity'
);

SELECT throws_ok(
  $$SELECT * FROM public.get_tour_availability_schedule('pgtap-availability-published', (now() AT TIME ZONE 'Africa/Cairo')::date + 1, (now() AT TIME ZONE 'Africa/Cairo')::date)$$,
  '22023',
  'Availability start date must not be after end date',
  'availability RPC rejects reversed date ranges'
);

SELECT throws_ok(
  $$SELECT * FROM public.get_tour_availability_schedule('  ', (now() AT TIME ZONE 'Africa/Cairo')::date, (now() AT TIME ZONE 'Africa/Cairo')::date)$$,
  '22023',
  'Tour identifier is required',
  'availability RPC rejects blank tour identifiers'
);

SELECT throws_ok(
  $$SELECT * FROM public.get_tour_availability_schedule('pgtap-availability-published', NULL, (now() AT TIME ZONE 'Africa/Cairo')::date)$$,
  '22023',
  'Availability start and end dates are required',
  'availability RPC rejects missing date bounds'
);

SET LOCAL request.jwt.claim.role = 'service_role';
SET LOCAL request.jwt.claims = '{"role":"service_role"}';

SELECT is(
  (SELECT count(*)::int FROM public.get_tour_availability_schedule('pgtap-availability-draft', (now() AT TIME ZONE 'Africa/Cairo')::date, (now() AT TIME ZONE 'Africa/Cairo')::date)),
  1,
  'trusted service-role callers retain access to draft tour schedules'
);

SELECT is(
  (SELECT notes FROM public.get_tour_availability_schedule('pgtap-availability-published', (now() AT TIME ZONE 'Africa/Cairo')::date, (now() AT TIME ZONE 'Africa/Cairo')::date)),
  'Internal operations note must not be public',
  'trusted service-role callers can read internal availability notes'
);

SELECT * FROM finish();
ROLLBACK;
