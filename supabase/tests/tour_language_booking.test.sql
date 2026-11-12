BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(4);

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

SELECT * FROM finish();
ROLLBACK;
