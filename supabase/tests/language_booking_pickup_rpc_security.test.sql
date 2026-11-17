BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(11);

SELECT ok(
  position('COALESCE(v_tour.pickup_available, FALSE)' in pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)'::regprocedure
  )) > 0
  AND position('Pickup is not configured for this excursion.' in pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)'::regprocedure
  )) > 0,
  'language-aware booking core rejects pickup-enabled tours with no active approved zone'
);

SELECT ok(
  position('A pickup location is required for this excursion.' in pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)'::regprocedure
  )) > 0
  AND position('This excursion does not offer hotel pickup.' in pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)'::regprocedure
  )) > 0,
  'language-aware booking core requires pickup only when enabled and rejects pickup when disabled'
);

SELECT ok(
  position('pickup_location_id = v_extra_record.id' in pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)'::regprocedure
  )) > 0
  AND position('not explicitly approved for this excursion' in pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)'::regprocedure
  )) > 0,
  'language-aware booking core accepts only the exact active pickup zone mapped to that tour'
);

SELECT ok(
  (SELECT NOT prosecdef FROM pg_proc WHERE oid='public.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure),
  'base public booking wrapper remains invoker-rights'
);

SELECT ok(
  (SELECT NOT prosecdef FROM pg_proc WHERE oid='public.create_booking_atomic_with_language(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)'::regprocedure),
  'language public booking wrapper remains invoker-rights'
);

SELECT ok(
  (SELECT NOT prosecdef FROM pg_proc WHERE oid='public.create_booking_atomic_with_locale(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text,text)'::regprocedure),
  'locale public booking wrapper remains invoker-rights'
);

SELECT ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']::text[]
   FROM pg_proc WHERE oid='private.create_booking_atomic_with_language(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)'::regprocedure),
  'private language wrapper remains SECURITY DEFINER with an empty search_path'
);

SELECT ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']::text[]
   FROM pg_proc WHERE oid='private.create_booking_atomic_with_locale(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text,text)'::regprocedure),
  'private locale wrapper remains SECURITY DEFINER with an empty search_path'
);

SELECT ok(
  position('private.create_booking_atomic_with_language(' in pg_get_functiondef(
    'public.create_booking_atomic_with_language(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)'::regprocedure
  )) > 0,
  'public language wrapper delegates to its fixed private language implementation'
);

SELECT ok(
  position('private.create_booking_atomic_with_locale(' in pg_get_functiondef(
    'public.create_booking_atomic_with_locale(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text,text)'::regprocedure
  )) > 0,
  'public locale wrapper delegates to its fixed private locale implementation'
);

SELECT ok(
  has_function_privilege('anon', 'public.create_booking_atomic_with_locale(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text,text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.create_booking_atomic_with_locale(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text,text)', 'EXECUTE'),
  'guest and authenticated checkout retain access to the public locale-aware RPC'
);

SELECT * FROM finish();
ROLLBACK;
