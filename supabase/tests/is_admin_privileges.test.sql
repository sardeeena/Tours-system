BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(4);

SELECT ok(
  NOT has_function_privilege('anon', 'public.is_admin()', 'EXECUTE'),
  'anonymous users cannot execute the administrator predicate'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE'),
  'authenticated users can evaluate administrator RLS policies'
);

SELECT ok(
  has_function_privilege('service_role', 'public.is_admin()', 'EXECUTE'),
  'service role retains administrator predicate execution'
);

SELECT ok(
  (SELECT NOT prosecdef FROM pg_proc WHERE oid = 'public.is_admin()'::regprocedure)
  AND (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']::text[]
       FROM pg_proc WHERE oid = 'private.is_admin()'::regprocedure),
  'public administrator predicate is invoker-rights and private implementation remains SECURITY DEFINER to avoid profiles RLS recursion'
);

SELECT * FROM finish();
ROLLBACK;
