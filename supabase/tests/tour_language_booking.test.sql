BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(9);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'tour_language'
      AND data_type = 'text'
  ),
  'bookings stores the selected tour language as a text snapshot'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('create_booking_atomic_with_language', 'lookup_booking_secure_with_language')
      AND p.prosecdef
  ),
  'public tour-language RPCs are invoker-rights wrappers'
);

SELECT ok(
  (
    SELECT count(*) = 2
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
      AND p.proname IN ('create_booking_atomic_with_language', 'lookup_booking_secure_with_language')
      AND p.prosecdef
      AND COALESCE(p.proconfig, ARRAY[]::text[]) @> ARRAY['search_path=""']::text[]
  ),
  'private tour-language implementations are SECURITY DEFINER with an empty search_path'
);

SELECT ok(
  has_function_privilege('anon', 'public.create_booking_atomic_with_language(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.create_booking_atomic_with_language(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)', 'EXECUTE')
  AND has_function_privilege('anon', 'public.lookup_booking_secure_with_language(text,text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.lookup_booking_secure_with_language(text,text)', 'EXECUTE'),
  'anonymous and authenticated customers can call the public invoker-rights booking RPCs'
);


SELECT ok(
  to_regprocedure('private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)') IS NOT NULL,
  'private atomic booking implementation accepts tour language as an input'
);

SELECT ok(
  (
    SELECT prosecdef
      AND COALESCE(proconfig, ARRAY[]::text[]) @> ARRAY['search_path=""']::text[]
      AND POSITION('idempotency_payload, tour_language' IN pg_get_functiondef(p.oid)) > 0
      AND POSITION('NULLIF(BTRIM(p_tour_language)' IN pg_get_functiondef(p.oid)) > 0
    FROM pg_proc p
    WHERE p.oid = to_regprocedure('private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)')
  ),
  'tour language is persisted by the SECURITY DEFINER booking INSERT function'
);

SELECT ok(
  POSITION('UPDATE public.bookings' IN
    pg_get_functiondef('private.create_booking_atomic_with_language(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)'::regprocedure)) = 0,
  'tour-language wrapper never performs a post-create booking UPDATE'
);

SELECT ok(
  has_function_privilege('anon', 'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)', 'EXECUTE'),
  'guest and authenticated roles can reach the private implementation only through the invoker-rights public RPC'
);

SELECT ok(
  to_regprocedure('private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)') IS NOT NULL,
  'the legacy atomic booking signature remains available for existing internal callers'
);

SELECT * FROM finish();
ROLLBACK;
