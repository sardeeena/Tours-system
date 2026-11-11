BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(7);

INSERT INTO public.tours (title, slug, status, price, max_guests)
VALUES ('pgTAP Fail-Closed Availability Test', 'pgtap-availability-fail-closed', 'published', 100.00, 10)
ON CONFLICT (slug) DO NOTHING;

CREATE TEMP TABLE booking_availability_test_context AS
SELECT id AS tour_id, slug, (CURRENT_DATE + 60)::date AS test_date
FROM public.tours
WHERE slug = 'pgtap-availability-fail-closed';

DELETE FROM public.tour_availability
WHERE tour_id = (SELECT tour_id FROM booking_availability_test_context)
  AND date = (SELECT test_date FROM booking_availability_test_context);

SELECT is(
  (SELECT status
   FROM public.get_tour_availability_schedule(
     (SELECT slug FROM booking_availability_test_context),
     (SELECT test_date FROM booking_availability_test_context),
     (SELECT test_date FROM booking_availability_test_context)
   )),
  'unavailable',
  'a date without an explicit availability row is unavailable'
);

SELECT is(
  (SELECT max_capacity
   FROM public.get_tour_availability_schedule(
     (SELECT slug FROM booking_availability_test_context),
     (SELECT test_date FROM booking_availability_test_context),
     (SELECT test_date FROM booking_availability_test_context)
   )),
  0,
  'a date without an explicit availability row has zero capacity'
);

SELECT is(
  (public.create_booking_atomic(
    (SELECT slug FROM booking_availability_test_context),
    (SELECT test_date FROM booking_availability_test_context),
    1, 0, 0,
    'Audit', 'NoSchedule',
    'audit-no-schedule@example.invalid',
    '+201000000001',
    'Egypt',
    'Audit Test Hotel',
    NULL, NULL,
    '[]'::jsonb,
    NULL,
    'pay_at_pickup',
    'ROLLBACK TEST ONLY',
    'audit-no-schedule-20261111-unique'
  )->>'success')::boolean,
  false,
  'guest booking is rejected when no explicit departure exists'
);

INSERT INTO public.tour_availability (tour_id, date, max_capacity, booked_count, status)
SELECT tour_id, test_date, 2, 0, 'available'
FROM booking_availability_test_context;

SELECT is(
  (SELECT is_available
   FROM public.get_tour_availability_schedule(
     (SELECT slug FROM booking_availability_test_context),
     (SELECT test_date FROM booking_availability_test_context),
     (SELECT test_date FROM booking_availability_test_context)
   )),
  true,
  'an explicitly scheduled date is bookable'
);

SELECT is(
  (public.create_booking_atomic(
    (SELECT slug FROM booking_availability_test_context),
    (SELECT test_date FROM booking_availability_test_context),
    1, 0, 0,
    'Audit', 'CapacityOne',
    'audit-capacity-one@example.invalid',
    '+201000000002',
    'Egypt',
    'Audit Test Hotel',
    NULL, NULL,
    '[]'::jsonb,
    NULL,
    'pay_at_pickup',
    'ROLLBACK TEST ONLY',
    'audit-capacity-one-20261111-unique'
  )->>'success')::boolean,
  true,
  'booking succeeds within explicitly configured capacity'
);

SELECT is(
  (SELECT remaining_capacity
   FROM public.get_tour_availability_schedule(
     (SELECT slug FROM booking_availability_test_context),
     (SELECT test_date FROM booking_availability_test_context),
     (SELECT test_date FROM booking_availability_test_context)
   )),
  1,
  'the booking consumes one seat from the configured capacity'
);

SELECT is(
  (public.create_booking_atomic(
    (SELECT slug FROM booking_availability_test_context),
    (SELECT test_date FROM booking_availability_test_context),
    2, 0, 0,
    'Audit', 'CapacityOverflow',
    'audit-capacity-overflow@example.invalid',
    '+201000000003',
    'Egypt',
    'Audit Test Hotel',
    NULL, NULL,
    '[]'::jsonb,
    NULL,
    'pay_at_pickup',
    'ROLLBACK TEST ONLY',
    'audit-capacity-overflow-20261111-unique'
  )->>'success')::boolean,
  false,
  'booking is rejected when it exceeds the explicit remaining capacity'
);

SELECT * FROM finish();

ROLLBACK;
