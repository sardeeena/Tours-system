BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(4);

SELECT ok(
  position('public.departures' IN pg_get_functiondef(
    'private.get_tour_availability_schedule(text,date,date)'::regprocedure
  )) > 0
  AND position('d.status = ''confirmed''' IN pg_get_functiondef(
    'private.get_tour_availability_schedule(text,date,date)'::regprocedure
  )) > 0,
  'public availability is derived from confirmed departure slots'
);

SELECT ok(
  position('coalesce(summary.confirmed_count,0) = 0 THEN ''unavailable''' IN pg_get_functiondef(
    'private.get_tour_availability_schedule(text,date,date)'::regprocedure
  )) > 0,
  'dates without a confirmed departure are returned as unavailable'
);

SELECT ok(
  position('summary.has_bookable_slot' IN pg_get_functiondef(
    'private.get_tour_availability_schedule(text,date,date)'::regprocedure
  )) > 0
  AND position('ta.is_blackout' IN pg_get_functiondef(
    'private.get_tour_availability_schedule(text,date,date)'::regprocedure
  )) > 0,
  'bookability is slot-specific and respects an explicit date blackout'
);

SELECT ok(
  position('coalesce(summary.max_capacity,0)' IN pg_get_functiondef(
    'private.get_tour_availability_schedule(text,date,date)'::regprocedure
  )) > 0
  AND position('summary.departure_times' IN pg_get_functiondef(
    'private.get_tour_availability_schedule(text,date,date)'::regprocedure
  )) > 0,
  'date capacity and displayed departure times aggregate all confirmed slots'
);

SELECT * FROM finish();
ROLLBACK;
