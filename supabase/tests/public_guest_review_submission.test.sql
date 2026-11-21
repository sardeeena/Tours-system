BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(9);

SELECT ok(
  to_regprocedure('public.submit_public_tour_review(uuid,text,text,text,integer,text,text)') IS NOT NULL,
  'public guest review submission RPC exists'
);

SELECT ok(
  (SELECT p.prosecdef
   FROM pg_proc AS p
   WHERE p.oid = to_regprocedure('public.submit_public_tour_review(uuid,text,text,text,integer,text,text)')),
  'guest review RPC runs as SECURITY DEFINER'
);

SELECT ok(
  (SELECT p.proconfig @> ARRAY['search_path=pg_catalog, public, pg_temp']
   FROM pg_proc AS p
   WHERE p.oid = to_regprocedure('public.submit_public_tour_review(uuid,text,text,text,integer,text,text)')),
  'guest review RPC pins a safe search_path'
);

SELECT ok(
  has_function_privilege('anon', 'public.submit_public_tour_review(uuid,text,text,text,integer,text,text)', 'EXECUTE'),
  'anonymous guests can execute only the scoped review submission RPC'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.submit_public_tour_review(uuid,text,text,text,integer,text,text)', 'EXECUTE'),
  'signed-in customers can use the same scoped review submission RPC'
);

SELECT ok(
  position('check_atomic_rate_limit' IN pg_get_functiondef(to_regprocedure('public.submit_public_tour_review(uuid,text,text,text,integer,text,text)'))) > 0,
  'guest submissions use the existing atomic network rate limiter'
);

SELECT ok(
  position('FALSE' IN pg_get_functiondef(to_regprocedure('public.submit_public_tour_review(uuid,text,text,text,integer,text,text)'))) > 0
  AND position('is_published' IN pg_get_functiondef(to_regprocedure('public.submit_public_tour_review(uuid,text,text,text,integer,text,text)'))) > 0
  AND position('verified_booking' IN pg_get_functiondef(to_regprocedure('public.submit_public_tour_review(uuid,text,text,text,integer,text,text)'))) > 0,
  'guest reviews are always unverified and unpublished pending moderation'
);

SET LOCAL ROLE anon;
SELECT lives_ok(
  $$ SELECT public.submit_public_tour_review(
    NULL,
    'Guest Review Test',
    'International',
    'DE',
    5,
    'A sufficiently detailed guest review for the automated database test.',
    'Couple'
  ) $$,
  'anonymous guest can submit a valid review without administrator privileges'
);
RESET ROLE;

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.reviews
    WHERE author_name = 'Guest Review Test'
      AND comment = 'A sufficiently detailed guest review for the automated database test.'
      AND is_published = FALSE
      AND verified_booking = FALSE
  ),
  'anonymous review is persisted only in the pending moderation state'
);

SELECT * FROM finish();
ROLLBACK;
