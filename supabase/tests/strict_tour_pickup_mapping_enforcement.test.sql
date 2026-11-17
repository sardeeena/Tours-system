BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(11);

SELECT ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']
   FROM pg_proc
   WHERE oid = 'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure),
  'private booking implementation remains SECURITY DEFINER with an empty search_path'
);

SELECT ok(
  NOT (SELECT prosecdef
       FROM pg_proc
       WHERE oid = 'public.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure),
  'public booking RPC remains an invoker-rights wrapper'
);

SELECT ok(
  position('COALESCE(v_tour.pickup_available, FALSE)' IN pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )) > 0,
  'pickup-enabled tours enter the strict pickup validation branch'
);

SELECT ok(
  position('Pickup is not configured for this excursion.' IN pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )) > 0,
  'pickup-enabled tours with no active approved mapping are rejected'
);

SELECT ok(
  position('A pickup location is required for this excursion.' IN pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )) > 0,
  'pickup-enabled tours require the customer to select an approved location'
);

SELECT ok(
  position('ELSIF p_pickup_location_id IS NOT NULL' IN pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )) > 0
  AND position('This excursion does not offer hotel pickup.' IN pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )) > 0,
  'tours with pickup disabled reject a supplied pickup location'
);

SELECT ok(
  position('AND is_active = TRUE' IN pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )) > 0,
  'only active pickup locations can be selected'
);

SELECT ok(
  position('INNER JOIN public.pickup_locations AS pl' IN pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )) > 0
  AND position('pickup_location_id = v_extra_record.id' IN pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )) > 0,
  'the selected active pickup location must be explicitly mapped to this tour'
);

SELECT ok(
  position('v_pickup_location_id := v_extra_record.id' IN pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )) > 0
  AND position('v_pickup_location_id,' IN pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )) > 0,
  'the validated pickup location ID is persisted to the booking'
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
  'strict pickup enforcement does not expose a client-callable public SECURITY DEFINER function'
);

SELECT * FROM finish();
ROLLBACK;
