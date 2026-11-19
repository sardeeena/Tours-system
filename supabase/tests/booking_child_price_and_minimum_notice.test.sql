BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(4);

SELECT ok(
  position('v_tour.child_price' IN pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )) > 0,
  'atomic booking uses the configured per-tour child price'
);

SELECT ok(
  position('v_departure_at' IN pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )) > 0
  AND position('minimum_booking_notice_hours' IN pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )) > 0
  AND position('Africa/Cairo' IN pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )) > 0,
  'atomic booking enforces the configured minimum notice using Egypt local time'
);

SELECT ok(
  position('COALESCE(p_child_count, 0) * (v_tour.price * 0.50)' IN pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )) = 0,
  'legacy adult-price 50 percent child calculation is removed'
);

SELECT ok(
  position('v_avail.departure_id IS NULL' IN pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )) > 0
  AND position('public.departures' IN pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )) > 0,
  'atomic booking requires a linked operator-confirmed departure'
);

SELECT * FROM finish();
ROLLBACK;
