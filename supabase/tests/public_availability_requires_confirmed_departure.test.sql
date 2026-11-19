BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(4);

SELECT ok(
  position('public.departures' IN pg_get_functiondef(
    'private.get_tour_availability_schedule(text,date,date)'::regprocedure
  )) > 0
  AND position('ta.departure_id' IN pg_get_functiondef(
    'private.get_tour_availability_schedule(text,date,date)'::regprocedure
  )) > 0,
  'public availability joins the actual departure linked to each date row'
);

SELECT ok(
  position('d.id IS NULL THEN ''unavailable''' IN pg_get_functiondef(
    'private.get_tour_availability_schedule(text,date,date)'::regprocedure
  )) > 0,
  'dates without a matching departure are returned as unavailable'
);

SELECT ok(
  position('d.id IS NULL THEN FALSE' IN pg_get_functiondef(
    'private.get_tour_availability_schedule(text,date,date)'::regprocedure
  )) > 0,
  'dates without a matching departure cannot be advertised as bookable'
);

SELECT ok(
  position('d.id IS NULL THEN 0' IN pg_get_functiondef(
    'private.get_tour_availability_schedule(text,date,date)'::regprocedure
  )) > 0,
  'dates without a matching departure expose zero capacity'
);

SELECT * FROM finish();
ROLLBACK;
