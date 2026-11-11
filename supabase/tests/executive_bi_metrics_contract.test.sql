BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(7);

SELECT ok(
  to_regprocedure('public.get_executive_bi_metrics(date,date)') IS NOT NULL,
  'executive BI metrics RPC exists'
);

SELECT ok(
  (SELECT NOT prosecdef AND proconfig @> ARRAY['search_path=""']::text[]
   FROM pg_proc
   WHERE oid = 'public.get_executive_bi_metrics(date,date)'::regprocedure)
  AND (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']::text[]
   FROM pg_proc
   WHERE oid = 'private.get_executive_bi_metrics(date,date)'::regprocedure),
  'executive BI public wrapper is invoker-rights and private implementation is SECURITY DEFINER'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.get_executive_bi_metrics(date,date)', 'EXECUTE'),
  'anonymous users cannot execute executive BI metrics'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.get_executive_bi_metrics(date,date)', 'EXECUTE'),
  'authenticated users can invoke executive BI metrics subject to internal admin authorization'
);

SELECT ok(
  POSITION('total_bookings_count' IN pg_get_functiondef('private.get_executive_bi_metrics(date,date)'::regprocedure)) > 0
  AND POSITION('latest_booking_date' IN pg_get_functiondef('private.get_executive_bi_metrics(date,date)'::regprocedure)) > 0
  AND POSITION('total_bookings ' IN pg_get_functiondef('private.get_executive_bi_metrics(date,date)'::regprocedure)) = 0
  AND POSITION('last_booking_date' IN pg_get_functiondef('private.get_executive_bi_metrics(date,date)'::regprocedure)) = 0,
  'executive metrics uses the actual customer aggregate columns'
);

SET LOCAL request.jwt.claim.role = 'service_role';
SET LOCAL request.jwt.claims = '{"role":"service_role"}';

SELECT ok(
  (
    public.get_executive_bi_metrics(CURRENT_DATE, CURRENT_DATE) ? 'revenue'
    AND public.get_executive_bi_metrics(CURRENT_DATE, CURRENT_DATE) ? 'bookings'
    AND public.get_executive_bi_metrics(CURRENT_DATE, CURRENT_DATE) ? 'passengers'
    AND public.get_executive_bi_metrics(CURRENT_DATE, CURRENT_DATE) ? 'customers'
    AND public.get_executive_bi_metrics(CURRENT_DATE, CURRENT_DATE) ? 'leads'
  ),
  'executive metrics executes successfully and returns the nested dashboard contract'
);

SELECT is(
  jsonb_typeof(public.query_custom_bi_report('{}'::jsonb)),
  'array',
  'custom BI report executes and returns an array for the report builder'
);

SELECT * FROM finish();
ROLLBACK;
