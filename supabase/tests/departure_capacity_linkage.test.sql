BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(5);

SELECT has_column(
  'public', 'tour_availability', 'departure_id',
  'availability slots can be linked to an operator departure'
);

SELECT has_column(
  'public', 'bookings', 'departure_id',
  'bookings can retain the exact departure assigned at booking time'
);

SELECT has_function(
  'public', 'upsert_departure_with_availability',
  ARRAY['uuid','uuid','date','text','text','integer','text','uuid','uuid','uuid','text'],
  'departure and availability are created or updated atomically'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.upsert_departure_with_availability(uuid,uuid,date,text,text,integer,text,uuid,uuid,uuid,text)',
    'EXECUTE'
  ),
  'anonymous callers cannot create or alter departures'
);

SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.upsert_departure_with_availability(uuid,uuid,date,text,text,integer,text,uuid,uuid,uuid,text)',
    'EXECUTE'
  ),
  'authenticated callers can invoke the RPC, which performs its own admin authorization check'
);

SELECT * FROM finish();

ROLLBACK;
