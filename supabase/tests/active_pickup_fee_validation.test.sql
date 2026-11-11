BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(7);

SELECT ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']
   FROM pg_proc
   WHERE oid = 'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure),
  'booking implementation remains SECURITY DEFINER with an empty search_path in the private schema'
);

SELECT ok(
  NOT (SELECT prosecdef
       FROM pg_proc
       WHERE oid = 'public.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure),
  'public booking RPC remains an invoker-rights wrapper'
);

SELECT ok(
  position('is_active = TRUE' IN pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )) > 0,
  'booking RPC rejects inactive pickup locations'
);

SELECT ok(
  position('public.tour_pickup_locations' IN pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )) > 0,
  'booking RPC enforces configured tour-specific pickup assignments'
);

SELECT ok(
  position('v_pickup_location_id := v_extra_record.id' IN pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )) > 0
  AND position('v_pickup_location_id,' IN pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )) > 0,
  'booking RPC stores the resolved pickup-location ID for both UUID and code inputs'
);

SELECT ok(
  has_function_privilege('anon', 'public.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)', 'EXECUTE'),
  'guest and authenticated booking RPC access is preserved'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'create_booking_atomic'
      AND p.prosecdef
      AND (has_function_privilege('anon', p.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
  ),
  'pickup validation does not reintroduce a client-callable public SECURITY DEFINER booking RPC'
);

SELECT * FROM finish();
ROLLBACK;
