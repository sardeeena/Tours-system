BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(23);

SELECT has_table('public','exclusive_trips','Exclusive product settings have their own table');
SELECT has_table('public','exclusive_departures','Exclusive schedule slots have their own table');
SELECT has_table('public','exclusive_reservations','Exclusive group reservations have their own table');
SELECT has_function(
  'public','save_exclusive_trip_settings',
  ARRAY['uuid','numeric','text','integer','integer','boolean'],
  'admin settings mutation saves the tour classification and fixed price atomically'
);
SELECT has_function(
  'public','update_exclusive_reservation_status',
  ARRAY['uuid','text','text'],
  'admin reservation updates synchronize the linked booking and payment status'
);
SELECT has_function(
  'public','reserve_exclusive_trip',
  ARRAY['uuid','integer','text','text','text','text','text','text','text','text','text'],
  'public reservation RPC is isolated from ordinary excursion booking'
);
SELECT ok(
  NOT has_table_privilege('anon','public.exclusive_reservations','SELECT')
  AND NOT has_table_privilege('anon','public.exclusive_reservations','INSERT'),
  'anonymous clients cannot read or directly insert private customer reservations'
);
SELECT ok(
  has_function_privilege('anon','public.reserve_exclusive_trip(uuid,integer,text,text,text,text,text,text,text,text,text)','EXECUTE'),
  'anonymous customers can use only the guarded reservation RPC'
);
SELECT has_function(
  'public','create_booking_atomic_with_departure',
  ARRAY['text','date','integer','integer','integer','text','text','text','text','text','text','text','text','jsonb','text','text','text','text','text','text','uuid'],
  'ordinary departure-aware booking RPC remains present and unchanged'
);

INSERT INTO public.tours (
  title,slug,duration,status,price,child_price,private_price,tour_type,max_guests,
  pickup_available,minimum_booking_notice_hours,is_exclusive
) VALUES (
  'pgTAP Exclusive Fixed Price Test',
  'pgtap-exclusive-fixed-price-test',
  '4 hours','published',80,20,200,'Private',10,FALSE,0,TRUE
);

CREATE TEMP TABLE exclusive_test_context (
  trip_id UUID,
  first_slot UUID,
  second_slot UUID,
  third_slot UUID,
  one_guest JSONB,
  max_guests JSONB,
  retry JSONB,
  over_limit_rejected BOOLEAN DEFAULT FALSE,
  duplicate_slot_rejected BOOLEAN DEFAULT FALSE,
  mismatched_idempotency_rejected BOOLEAN DEFAULT FALSE
) ON COMMIT DROP;

INSERT INTO exclusive_test_context DEFAULT VALUES;

INSERT INTO public.exclusive_trips (
  tour_id,fixed_trip_price,currency,minimum_guests,maximum_guests,is_active
)
SELECT id,950.00,'EUR',1,10,TRUE
FROM public.tours WHERE slug='pgtap-exclusive-fixed-price-test'
;

UPDATE exclusive_test_context
SET trip_id = (SELECT et.id FROM public.exclusive_trips et
  JOIN public.tours t ON t.id=et.tour_id WHERE t.slug='pgtap-exclusive-fixed-price-test');

WITH slots AS (
  INSERT INTO public.exclusive_departures (
    exclusive_trip_id,date,start_time,end_time,maximum_guests,status
  )
  SELECT trip_id,CURRENT_DATE+20,'08:00','12:00',10,'confirmed' FROM exclusive_test_context
  RETURNING id,start_time
)
UPDATE exclusive_test_context SET
  first_slot=(SELECT id FROM slots WHERE start_time='08:00');

WITH slots AS (
  INSERT INTO public.exclusive_departures (
    exclusive_trip_id,date,start_time,end_time,maximum_guests,status
  )
  SELECT trip_id,CURRENT_DATE+20,'13:00','17:00',10,'confirmed' FROM exclusive_test_context
  RETURNING id,start_time
)
UPDATE exclusive_test_context SET
  second_slot=(SELECT id FROM slots WHERE start_time='13:00');

WITH slots AS (
  INSERT INTO public.exclusive_departures (
    exclusive_trip_id,date,start_time,end_time,maximum_guests,status
  )
  SELECT trip_id,CURRENT_DATE+21,'08:00','12:00',10,'confirmed' FROM exclusive_test_context
  RETURNING id,start_time
)
UPDATE exclusive_test_context SET
  third_slot=(SELECT id FROM slots WHERE start_time='08:00');

UPDATE exclusive_test_context
SET one_guest = public.reserve_exclusive_trip(
  first_slot,1,'One','Guest','one-exclusive@example.test','+201000000001',
  'Egypt','Test Hotel','pay_at_pickup',NULL,'idem-exclusive-one-guest-001'
);

UPDATE exclusive_test_context
SET max_guests = public.reserve_exclusive_trip(
  second_slot,10,'Ten','Guests','ten-exclusive@example.test','+201000000010',
  'Egypt','Test Hotel','pay_at_pickup',NULL,'idem-exclusive-ten-guests-001'
);

SELECT is(
  (SELECT (one_guest->>'total')::NUMERIC FROM exclusive_test_context),
  950.00::NUMERIC,
  'one guest is charged the fixed trip price'
);
SELECT is(
  (SELECT (max_guests->>'total')::NUMERIC FROM exclusive_test_context),
  950.00::NUMERIC,
  'maximum guest count is charged the same fixed trip price'
);
SELECT is(
  (SELECT b.total FROM public.bookings b
   WHERE b.id=(SELECT (one_guest->>'bookingId')::UUID FROM exclusive_test_context)),
  950.00::NUMERIC,
  'one-guest Exclusive booking is also recorded at the fixed trip price in the shared finance ledger'
);
SELECT is(
  (SELECT b.total FROM public.bookings b
   WHERE b.id=(SELECT (max_guests->>'bookingId')::UUID FROM exclusive_test_context)),
  950.00::NUMERIC,
  'maximum-group Exclusive booking is recorded at the same fixed total in the shared finance ledger'
);
SELECT is(
  (SELECT b.booking_kind FROM public.bookings b
   WHERE b.id=(SELECT (one_guest->>'bookingId')::UUID FROM exclusive_test_context)),
  'exclusive',
  'shared booking record is explicitly classified as Exclusive'
);
SELECT ok(
  (SELECT r.booking_id=(SELECT (one_guest->>'bookingId')::UUID FROM exclusive_test_context)
   FROM public.exclusive_reservations r
   WHERE r.id=(SELECT (one_guest->>'reservationId')::UUID FROM exclusive_test_context)),
  'Exclusive reservation is linked one-to-one to its shared booking record'
);
SELECT ok(
  (SELECT b.customer_id IS NOT NULL FROM public.bookings b
   WHERE b.id=(SELECT (one_guest->>'bookingId')::UUID FROM exclusive_test_context)),
  'Exclusive booking reuses the shared customer directory'
);
SELECT is(
  (SELECT (one_guest->>'total')::NUMERIC FROM exclusive_test_context),
  (SELECT (max_guests->>'total')::NUMERIC FROM exclusive_test_context),
  'total price is independent of guest count'
);

UPDATE exclusive_test_context
SET retry = public.reserve_exclusive_trip(
  first_slot,1,'One','Guest','one-exclusive@example.test','+201000000001',
  'Egypt','Test Hotel','pay_at_pickup',NULL,'idem-exclusive-one-guest-001'
);
SELECT is(
  (SELECT retry->>'reservationReference' FROM exclusive_test_context),
  (SELECT one_guest->>'reservationReference' FROM exclusive_test_context),
  'retry returns the original reservation rather than creating a second one'
);

SELECT ok(
  NOT public.is_exclusive_departure_available((SELECT first_slot FROM exclusive_test_context)),
  'a reserved exclusive slot is no longer publicly bookable'
);
SELECT ok(
  public.is_exclusive_departure_available((SELECT third_slot FROM exclusive_test_context)),
  'an unreserved confirmed exclusive slot remains publicly bookable'
);

DO $test$
BEGIN
  BEGIN
    PERFORM public.reserve_exclusive_trip(
      (SELECT third_slot FROM exclusive_test_context),11,
      'Over','Limit','over-limit-exclusive@example.test','+201000000011',
      'Egypt',NULL,'pay_at_pickup',NULL,'idem-exclusive-over-limit-001'
    );
  EXCEPTION WHEN SQLSTATE '22023' THEN
    UPDATE exclusive_test_context SET over_limit_rejected=TRUE;
  END;
  BEGIN
    PERFORM public.reserve_exclusive_trip(
      (SELECT first_slot FROM exclusive_test_context),2,
      'Second','Group','second-exclusive@example.test','+201000000002',
      'Egypt',NULL,'pay_at_pickup',NULL,'idem-exclusive-duplicate-slot-001'
    );
  EXCEPTION WHEN SQLSTATE '23505' THEN
    UPDATE exclusive_test_context SET duplicate_slot_rejected=TRUE;
  END;
  BEGIN
    PERFORM public.reserve_exclusive_trip(
      (SELECT second_slot FROM exclusive_test_context),1,
      'One','Guest','one-exclusive@example.test','+201000000001',
      'Egypt','Test Hotel','pay_at_pickup',NULL,'idem-exclusive-one-guest-001'
    );
  EXCEPTION WHEN SQLSTATE '22023' THEN
    UPDATE exclusive_test_context SET mismatched_idempotency_rejected=TRUE;
  END;
END;
$test$;

SELECT ok(
  (SELECT over_limit_rejected FROM exclusive_test_context),
  'guest counts above the configured maximum are rejected'
);
SELECT ok(
  (SELECT duplicate_slot_rejected FROM exclusive_test_context),
  'a second group cannot reserve an already reserved exclusive slot'
);
SELECT ok(
  (SELECT mismatched_idempotency_rejected FROM exclusive_test_context),
  'an idempotency key cannot be replayed against a different departure'
);

SELECT * FROM finish();
ROLLBACK;
