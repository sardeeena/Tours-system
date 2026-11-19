BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(18);

SELECT has_function(
  'public','get_tour_departure_slots',ARRAY['text','date'],
  'public booking flow can retrieve individual departure slots'
);

SELECT has_function(
  'public','create_booking_atomic_with_departure',
  ARRAY['text','date','integer','integer','integer','text','text','text','text','text','text','text','text','jsonb','text','text','text','text','text','text','uuid'],
  'atomic booking accepts the customer-selected departure ID'
);

INSERT INTO public.tours (
  title,slug,status,price,child_price,private_price,tour_type,max_guests,pickup_available,minimum_booking_notice_hours
) VALUES (
  'pgTAP Multi Departure Private Tour',
  'pgtap-multi-departure-private',
  'published',
  80.00,
  20.00,
  200.00,
  'Private',
  10,
  FALSE,
  0
);

CREATE TEMP TABLE multi_departure_context (
  tour_id UUID NOT NULL,
  test_date DATE NOT NULL,
  first_departure_id UUID,
  second_departure_id UUID,
  booking_result JSONB
) ON COMMIT DROP;

INSERT INTO multi_departure_context (tour_id,test_date)
SELECT id,CURRENT_DATE + 30
FROM public.tours
WHERE slug = 'pgtap-multi-departure-private';

INSERT INTO public.tour_availability (tour_id,date,max_capacity,booked_count,status,is_blackout)
SELECT tour_id,test_date,5,0,'unavailable',FALSE
FROM multi_departure_context;

WITH created AS (
  INSERT INTO public.departures (
    tour_id,date,start_time,end_time,capacity,booked_passengers,remaining_capacity,status
  )
  SELECT tour_id,test_date,'09:00','12:00',2,0,2,'confirmed'
  FROM multi_departure_context
  RETURNING id,tour_id,date
)
UPDATE multi_departure_context AS context
SET first_departure_id = created.id
FROM created
WHERE context.tour_id = created.tour_id AND context.test_date = created.date;

WITH created AS (
  INSERT INTO public.departures (
    tour_id,date,start_time,end_time,capacity,booked_passengers,remaining_capacity,status
  )
  SELECT tour_id,test_date,'14:00','17:00',3,0,3,'confirmed'
  FROM multi_departure_context
  RETURNING id,tour_id,date
)
UPDATE multi_departure_context AS context
SET second_departure_id = created.id
FROM created
WHERE context.tour_id = created.tour_id AND context.test_date = created.date;

SELECT is(
  (SELECT count(*)::INTEGER
   FROM public.get_tour_departure_slots(
     'pgtap-multi-departure-private',
     (SELECT test_date FROM multi_departure_context)
   )),
  2,
  'both confirmed times on one date are independently returned'
);

SELECT is(
  (SELECT max_capacity
   FROM public.get_tour_availability_schedule(
     'pgtap-multi-departure-private',
     (SELECT test_date FROM multi_departure_context),
     (SELECT test_date FROM multi_departure_context)
   )),
  5,
  'daily capacity is the sum of both departure capacities'
);

UPDATE multi_departure_context
SET booking_result = public.create_booking_atomic_with_departure(
  'pgtap-multi-departure-private',
  test_date,
  1,1,0,
  'Multi','Slot',
  'multi-slot-private@example.test',
  '+201000000081',
  'Egypt',
  'Test Hotel',
  NULL,NULL,
  '[]'::jsonb,
  NULL,
  'pay_at_pickup',
  'ROLLBACK TEST ONLY',
  'idem_multi_departure_private_slot_0001',
  'English',
  'en',
  first_departure_id
);

SELECT is(
  (SELECT (booking_result->>'success')::BOOLEAN FROM multi_departure_context),
  TRUE,
  'the selected departure can be booked successfully'
);

SELECT is(
  (SELECT (booking_result->>'totalEur')::NUMERIC FROM multi_departure_context),
  400.00::NUMERIC,
  'private per-person price is charged for both adults and children'
);

SELECT is(
  (SELECT booking_result->>'departureTime' FROM multi_departure_context),
  '09:00',
  'booking result returns the exact selected departure time'
);

SELECT is(
  (SELECT departure_id
   FROM public.bookings
   WHERE id = (SELECT (booking_result->>'bookingId')::UUID FROM multi_departure_context)),
  (SELECT first_departure_id FROM multi_departure_context),
  'the new booking stores the exact selected departure ID'
);

SELECT is(
  (SELECT unit_price_adult
   FROM public.bookings
   WHERE id = (SELECT (booking_result->>'bookingId')::UUID FROM multi_departure_context)),
  200.00::NUMERIC,
  'private adult unit price is persisted per person'
);

SELECT is(
  (SELECT unit_price_child
   FROM public.bookings
   WHERE id = (SELECT (booking_result->>'bookingId')::UUID FROM multi_departure_context)),
  200.00::NUMERIC,
  'private child unit price is the same per-person rate'
);

SELECT is(
  (SELECT booked_passengers
   FROM public.departures
   WHERE id = (SELECT first_departure_id FROM multi_departure_context)),
  2,
  'the selected slot alone consumes its two passenger places'
);

SELECT is(
  (SELECT remaining_capacity
   FROM public.departures
   WHERE id = (SELECT second_departure_id FROM multi_departure_context)),
  3,
  'the other departure retains its independent capacity'
);

SELECT is(
  (SELECT remaining_capacity
   FROM public.get_tour_availability_schedule(
     'pgtap-multi-departure-private',
     (SELECT test_date FROM multi_departure_context),
     (SELECT test_date FROM multi_departure_context)
   )),
  3,
  'daily remaining capacity aggregates the independent slots'
);

SELECT throws_ok(
  'UPDATE public.departures SET status = ''cancelled'' WHERE id = (SELECT first_departure_id FROM multi_departure_context)',
  '23514',
  'A departure with active bookings cannot be cancelled until its bookings are resolved.',
  'a departure with active bookings cannot be cancelled'
);

SELECT throws_ok(
  'DELETE FROM public.departures WHERE id = (SELECT first_departure_id FROM multi_departure_context)',
  '23514',
  'A departure referenced by a booking cannot be deleted; retain it for booking and audit history.',
  'a departure referenced by any booking cannot be deleted'
);

SELECT is(
  (SELECT status FROM public.departures WHERE id = (SELECT first_departure_id FROM multi_departure_context)),
  'confirmed',
  'failed cancellation leaves the booked departure unchanged'
);

SELECT is(
  (public.create_booking_atomic(
    'pgtap-multi-departure-private',
    (SELECT test_date FROM multi_departure_context),
    1,0,0,
    'Legacy','Ambiguous',
    'multi-slot-ambiguous@example.test',
    '+201000000082',
    'Egypt',
    'Test Hotel',
    NULL,NULL,
    '[]'::jsonb,
    NULL,
    'pay_at_pickup',
    'ROLLBACK TEST ONLY',
    'idem_multi_departure_ambiguous_0001'
  )->>'success')::BOOLEAN,
  FALSE,
  'legacy booking RPC fails closed when more than one confirmed time exists'
);

SELECT ok(
  (public.create_booking_atomic(
    'pgtap-multi-departure-private',
    (SELECT test_date FROM multi_departure_context),
    1,0,0,
    'Legacy','Ambiguous',
    'multi-slot-ambiguous-2@example.test',
    '+201000000083',
    'Egypt',
    'Test Hotel',
    NULL,NULL,
    '[]'::jsonb,
    NULL,
    'pay_at_pickup',
    'ROLLBACK TEST ONLY',
    'idem_multi_departure_ambiguous_0002'
  )->>'error') ILIKE '%select a departure time%',
  'ambiguous legacy booking receives a clear departure-selection error'
);

SELECT * FROM finish();
ROLLBACK;
