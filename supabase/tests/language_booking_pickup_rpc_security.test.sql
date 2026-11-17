BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(16);

SELECT ok(
  position('COALESCE(v_tour.pickup_available, FALSE)' in pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)'::regprocedure
  )) > 0
  AND position('Pickup is not configured for this excursion.' in pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)'::regprocedure
  )) > 0
  AND position('not explicitly approved for this excursion' in pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)'::regprocedure
  )) > 0,
  'language-aware booking core enforces required pickup and exact active tour mapping'
);

SELECT ok(
  has_function_privilege('anon', 'public.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)', 'EXECUTE'),
  'base public booking RPC remains available to guest and authenticated checkout'
);

SELECT ok(
  has_function_privilege('anon', 'public.create_booking_atomic_with_language(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.create_booking_atomic_with_language(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)', 'EXECUTE'),
  'language-aware public booking RPC remains available to guest and authenticated checkout'
);

SELECT ok(
  has_function_privilege('anon', 'public.create_booking_atomic_with_locale(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text,text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.create_booking_atomic_with_locale(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text,text)', 'EXECUTE'),
  'locale-aware public booking RPC remains available to guest and authenticated checkout'
);

SELECT ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']
   FROM pg_proc WHERE oid='public.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure),
  'base public wrapper is SECURITY DEFINER with an empty search_path'
);

SELECT ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']
   FROM pg_proc WHERE oid='public.create_booking_atomic_with_language(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)'::regprocedure),
  'language public wrapper is SECURITY DEFINER with an empty search_path'
);

SELECT ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']
   FROM pg_proc WHERE oid='public.create_booking_atomic_with_locale(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text,text)'::regprocedure),
  'locale public wrapper is SECURITY DEFINER with an empty search_path'
);

SELECT ok(
  NOT has_function_privilege('anon', 'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)', 'EXECUTE'),
  'client roles cannot directly execute the strict base private booking function'
);

SELECT ok(
  NOT has_function_privilege('anon', 'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)', 'EXECUTE'),
  'client roles cannot directly execute the language-aware private booking core'
);

SELECT ok(
  NOT has_function_privilege('anon', 'private.create_booking_atomic_with_language(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'private.create_booking_atomic_with_language(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)', 'EXECUTE'),
  'client roles cannot directly execute the private language wrapper'
);

SELECT ok(
  NOT has_function_privilege('anon', 'private.create_booking_atomic_with_locale(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text,text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'private.create_booking_atomic_with_locale(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text,text)', 'EXECUTE'),
  'client roles cannot directly execute the private locale wrapper'
);

SELECT ok(
  has_function_privilege('service_role', 'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)', 'EXECUTE')
  AND has_function_privilege('service_role', 'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)', 'EXECUTE')
  AND has_function_privilege('service_role', 'private.create_booking_atomic_with_language(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)', 'EXECUTE')
  AND has_function_privilege('service_role', 'private.create_booking_atomic_with_locale(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text,text)', 'EXECUTE'),
  'service role retains private booking implementation access'
);

SELECT ok(
  position('private.create_booking_atomic(' in pg_get_functiondef(
    'public.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )) > 0,
  'base public wrapper delegates only to its fixed private implementation'
);

SELECT ok(
  position('private.create_booking_atomic(' in pg_get_functiondef(
    'private.create_booking_atomic_with_language(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)'::regprocedure
  )) > 0,
  'language-aware private wrapper delegates to the protected strict core'
);

SELECT ok(
  position('public.create_booking_atomic_with_language(' in pg_get_functiondef(
    'public.create_booking_atomic_with_locale(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text,text)'::regprocedure
  )) > 0,
  'locale-aware public wrapper delegates through the protected language-aware entry point'
);

SELECT ok(
  NOT has_function_privilege('anon', 'private.create_booking_atomic_with_language(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'private.create_booking_atomic_with_language(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)', 'EXECUTE'),
  'private language wrapper is not directly executable by client roles'
);

SELECT * FROM finish();
ROLLBACK;
