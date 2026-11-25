BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(36);

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
  booking_result JSONB,
  retry_result JSONB,
  mismatched_retry_result JSONB,
  cancellation_result JSONB,
  repeated_cancellation_result JSONB,
  second_booking_result JSONB,
  rejection_result JSONB,
  rejection_previous_status TEXT
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
  (SELECT start_time FROM public.departures WHERE id = (SELECT first_departure_id FROM multi_departure_context)),
  '09:00',
  'the selected departure fixture persists its exact start time'
);

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

-- A retry after the first request has filled the slot must still return the
-- original booking instead of failing the now-full capacity check.
UPDATE multi_departure_context
SET retry_result = public.create_booking_atomic_with_departure(
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
  (SELECT (retry_result->>'success')::BOOLEAN FROM multi_departure_context),
  TRUE,
  'an exact retry succeeds even after the original booking fills the departure'
);

SELECT is(
  (SELECT (retry_result->>'bookingId')::UUID FROM multi_departure_context),
  (SELECT (booking_result->>'bookingId')::UUID FROM multi_departure_context),
  'an idempotent retry returns the original booking ID'
);

SELECT is(
  (SELECT retry_result->>'departureTime' FROM multi_departure_context),
  '09:00',
  'an idempotent retry also returns the original selected departure time'
);

-- The same idempotency key cannot be replayed against another departure.
UPDATE multi_departure_context
SET mismatched_retry_result = public.create_booking_atomic_with_departure(
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
  second_departure_id
);

SELECT is(
  (SELECT (mismatched_retry_result->>'success')::BOOLEAN FROM multi_departure_context),
  FALSE,
  'reusing an idempotency key with a different departure is rejected'
);

SELECT is(
  (SELECT booked_passengers
   FROM public.departures
   WHERE id = (SELECT second_departure_id FROM multi_departure_context)),
  0,
  'a mismatched idempotency replay does not consume the newly selected departure capacity'
);

SELECT is(
  (SELECT booked_passengers
   FROM public.departures
   WHERE id = (SELECT first_departure_id FROM multi_departure_context)),
  2,
  'an idempotent retry does not consume departure capacity twice'
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
  (public.create_booking_atomic_with_departure(
    'pgtap-multi-departure-private',
    (SELECT test_date FROM multi_departure_context),
    1,0,0,
    'Capacity','Overflow',
    'multi-slot-overflow@example.test',
    '+201000000084',
    'Egypt',
    'Test Hotel',
    NULL,NULL,
    '[]'::jsonb,
    NULL,
    'pay_at_pickup',
    'ROLLBACK TEST ONLY',
    'idem_multi_departure_overflow_0001',
    'English',
    'en',
    (SELECT first_departure_id FROM multi_departure_context)
  )->>'success')::BOOLEAN,
  FALSE,
  'a booking that exceeds the selected departure capacity is rejected'
);

SELECT is(
  (public.create_booking_atomic_with_departure(
    'pgtap-multi-departure-private',
    (SELECT test_date FROM multi_departure_context),
    1,0,0,
    'Invalid','Departure',
    'multi-slot-invalid-departure@example.test',
    '+201000000085',
    'Egypt',
    'Test Hotel',
    NULL,NULL,
    '[]'::jsonb,
    NULL,
    'pay_at_pickup',
    'ROLLBACK TEST ONLY',
    'idem_multi_departure_invalid_0001',
    'English',
    'en',
    'ffffffff-ffff-4fff-8fff-ffffffffffff'::UUID
  )->>'success')::BOOLEAN,
  FALSE,
  'a departure ID that does not belong to the selected tour and date is rejected'
);

SELECT is(
  (public.create_booking_atomic_with_departure(
    'pgtap-multi-departure-private',
    (SELECT test_date FROM multi_departure_context),
    1,0,0,
    'Missing','Departure',
    'multi-slot-missing-departure@example.test',
    '+201000000086',
    'Egypt',
    'Test Hotel',
    NULL,NULL,
    '[]'::jsonb,
    NULL,
    'pay_at_pickup',
    'ROLLBACK TEST ONLY',
    'idem_multi_departure_missing_0001',
    'English',
    'en',
    NULL
  )->>'success')::BOOLEAN,
  FALSE,
  'a booking without an explicitly selected departure is rejected'
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

-- Exercise the real cancellation resolver against departure-linked bookings.
-- These operations run inside this pgTAP transaction and are rolled back.
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', TRUE);

UPDATE public.bookings
SET cancellation_previous_status = status,
    status = 'cancellation_requested'
WHERE id = (SELECT (booking_result->>'bookingId')::UUID FROM multi_departure_context);

UPDATE multi_departure_context
SET cancellation_result = private.admin_resolve_booking_cancellation(
  (booking_result->>'bookingReference'), 'approve', 'pgTAP cancellation capacity test'
);

SELECT is(
  (SELECT (cancellation_result->>'success')::BOOLEAN FROM multi_departure_context),
  TRUE,
  'departure-linked cancellation approval succeeds'
);
SELECT is(
  (SELECT status FROM public.bookings WHERE id = (SELECT (booking_result->>'bookingId')::UUID FROM multi_departure_context)),
  'cancelled',
  'approved cancellation marks the booking cancelled'
);
SELECT is(
  (SELECT booked_passengers FROM public.departures WHERE id = (SELECT first_departure_id FROM multi_departure_context)),
  0,
  'approved cancellation releases the selected departure passenger count exactly once'
);
SELECT is(
  (SELECT remaining_capacity FROM public.departures WHERE id = (SELECT first_departure_id FROM multi_departure_context)),
  2,
  'approved cancellation restores the selected departure remaining capacity'
);

UPDATE multi_departure_context
SET repeated_cancellation_result = private.admin_resolve_booking_cancellation(
  (booking_result->>'bookingReference'), 'approve', 'repeat approval must be idempotent'
);
SELECT is(
  (SELECT (repeated_cancellation_result->>'alreadyResolved')::BOOLEAN FROM multi_departure_context),
  TRUE,
  'repeated cancellation approval is idempotent'
);

UPDATE multi_departure_context
SET second_booking_result = public.create_booking_atomic_with_departure(
  'pgtap-multi-departure-private',
  test_date,
  1,0,0,
  'Reject','Cancellation',
  'multi-slot-reject@example.test',
  '+201000000087',
  'Egypt',
  'Test Hotel',
  NULL,NULL,
  '[]'::jsonb,
  NULL,
  'pay_at_pickup',
  'ROLLBACK TEST ONLY',
  'idem_multi_departure_reject_cancel_0001',
  'English',
  'en',
  second_departure_id
);
UPDATE multi_departure_context
SET rejection_previous_status = (
  SELECT status FROM public.bookings
  WHERE id = (second_booking_result->>'bookingId')::UUID
);
UPDATE public.bookings
SET cancellation_previous_status = status,
    status = 'cancellation_requested'
WHERE id = (SELECT (second_booking_result->>'bookingId')::UUID FROM multi_departure_context);
UPDATE multi_departure_context
SET rejection_result = private.admin_resolve_booking_cancellation(
  (second_booking_result->>'bookingReference'), 'reject', 'pgTAP rejection capacity test'
);
SELECT is(
  (SELECT (rejection_result->>'success')::BOOLEAN FROM multi_departure_context),
  TRUE,
  'cancellation rejection succeeds for a pending cancellation request'
);
SELECT is(
  (SELECT status FROM public.bookings WHERE id = (SELECT (second_booking_result->>'bookingId')::UUID FROM multi_departure_context)),
  (SELECT rejection_previous_status FROM multi_departure_context),
  'rejected cancellation restores the booking''s exact prior status'
);
SELECT is(
  (SELECT booked_passengers FROM public.departures WHERE id = (SELECT second_departure_id FROM multi_departure_context)),
  1,
  'rejecting cancellation retains the booking''s departure capacity'
);

SELECT * FROM finish();
ROLLBACK;
