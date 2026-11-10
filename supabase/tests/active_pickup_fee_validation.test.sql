BEGIN;
SELECT plan(3);

SELECT ok(
  position(
    'AND is_active = TRUE'
    IN pg_get_functiondef('public.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure)
  ) > 0,
  'booking RPC only accepts active pickup locations'
);

SELECT ok(
  position(
    'v_pickup_location_id := v_extra_record.id'
    IN pg_get_functiondef('public.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure)
  ) > 0,
  'booking RPC persists the resolved pickup location ID even when the client sends a location code'
);

SELECT ok(
  position(
    'public.tour_pickup_locations'
    IN pg_get_functiondef('public.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure)
  ) > 0,
  'booking RPC enforces explicit tour pickup assignments when configured'
);

SELECT * FROM finish();
ROLLBACK;
