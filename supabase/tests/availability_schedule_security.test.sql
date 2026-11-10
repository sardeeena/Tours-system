BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(15);

INSERT INTO public.tours (id, title, slug, status, max_guests)
VALUES
  ('a9000000-0000-0000-0000-000000000001', 'Published availability test', 'pgtap-availability-published', 'published', 12),
  ('a9000000-0000-0000-0000-000000000002', 'Draft availability test', 'pgtap-availability-draft', 'draft', 12),
  ('a9000000-0000-0000-0000-000000000003', 'Archived availability test', 'pgtap-availability-archived', 'archived', 12);

INSERT INTO public.tour_availability (tour_id, date, status, max_capacity, booked_count, notes)
VALUES ('a9000000-0000-0000-0000-000000000001', CURRENT_DATE, 'available', 12, 0, 'Internal operations note must not be public');

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
  (SELECT count(*)::int FROM public.get_tour_availability_schedule('pgtap-availability-published', CURRENT_DATE, CURRENT_DATE)),
  1,
  'anonymous availability lookup returns a published tour'
);

SELECT is(
  (SELECT count(*)::int FROM public.get_tour_availability_schedule('pgtap-availability-draft', CURRENT_DATE, CURRENT_DATE)),
  0,
  'anonymous availability lookup hides draft tours'
);

SELECT is(
  (SELECT count(*)::int FROM public.get_tour_availability_schedule('pgtap-availability-archived', CURRENT_DATE, CURRENT_DATE)),
  0,
  'anonymous availability lookup hides archived tours'
);

SELECT is(
  (SELECT notes FROM public.get_tour_availability_schedule('pgtap-availability-published', CURRENT_DATE, CURRENT_DATE)),
  NULL::text,
  'anonymous availability lookup never exposes internal operational notes'
);

SELECT is(
  (SELECT count(*)::int FROM public.get_tour_availability_schedule('pgtap-availability-published', CURRENT_DATE, CURRENT_DATE + 365)),
  366,
  'the maximum supported date range contains 366 calendar days'
);

SELECT throws_ok(
  $SELECT * FROM public.get_tour_availability_schedule('pgtap-availability-published', CURRENT_DATE, CURRENT_DATE + 366)$,
  '22023',
  'Availability date range cannot exceed 366 days',
  'availability RPC rejects date ranges longer than 366 days'
);

SELECT throws_ok(
  $SELECT * FROM public.get_tour_availability_schedule('pgtap-availability-published', CURRENT_DATE - 1, CURRENT_DATE - 1)$,
  '22023',
  'Public availability lookup cannot include past dates',
  'anonymous availability lookup cannot disclose historical booking capacity'
);

SELECT throws_ok(
  $$SELECT * FROM public.get_tour_availability_schedule('pgtap-availability-published', CURRENT_DATE + 1, CURRENT_DATE)$$,
  '22023',
  'Availability start date must not be after end date',
  'availability RPC rejects reversed date ranges'
);

SELECT throws_ok(
  $$SELECT * FROM public.get_tour_availability_schedule('  ', CURRENT_DATE, CURRENT_DATE)$$,
  '22023',
  'Tour identifier is required',
  'availability RPC rejects blank tour identifiers'
);

SELECT throws_ok(
  $$SELECT * FROM public.get_tour_availability_schedule('pgtap-availability-published', NULL, CURRENT_DATE)$$,
  '22023',
  'Availability start and end dates are required',
  'availability RPC rejects missing date bounds'
);

SELECT * FROM finish();
ROLLBACK;
