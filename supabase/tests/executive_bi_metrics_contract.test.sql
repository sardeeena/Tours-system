BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(9);

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

INSERT INTO public.tours (title, slug, status, price, max_guests)
VALUES ('pgTAP Executive Refund Test Tour', 'pgtap-executive-refund-test', 'published', 100.00, 10);

INSERT INTO public.tour_availability (tour_id, date, max_capacity, booked_count, status)
SELECT id, CURRENT_DATE + 45, 10, 0, 'available'
FROM public.tours WHERE slug = 'pgtap-executive-refund-test';

CREATE TEMP TABLE executive_refund_test_state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
) ON COMMIT DROP;

INSERT INTO executive_refund_test_state (key, value)
SELECT 'booking', public.create_booking_atomic(
  'pgtap-executive-refund-test', CURRENT_DATE + 45, 1, 0, 0,
  'Executive', 'Refund', 'pgtap-executive-refund@example.test', '+201000000008', 'Egypt',
  'Test Hotel', NULL, NULL, '[]'::jsonb, NULL,
  'pay_at_pickup', NULL, 'idem_pgtap_exec_refund_booking_001'
);

INSERT INTO executive_refund_test_state (key, value)
SELECT 'payment', public.record_payment_atomic(
  (SELECT value->>'bookingReference' FROM executive_refund_test_state WHERE key = 'booking'),
  100.00, 'EUR', 'Cash', 'cash', 'Paid', 'PGTAP-EXEC-REFUND-PAY-001',
  'Executive metrics refund test payment', 'pgTAP', 'idem_pgtap_exec_refund_payment_001'
);

INSERT INTO executive_refund_test_state (key, value)
SELECT 'refund_request', public.request_refund_atomic(
  (SELECT value->>'bookingReference' FROM executive_refund_test_state WHERE key = 'booking'),
  ((SELECT value->'payment'->>'id' FROM executive_refund_test_state WHERE key = 'payment'))::uuid,
  30.00, 'EUR', 'Executive metrics refund test', 'Cash Return', 'pgTAP', NULL,
  'idem_pgtap_exec_refund_request_001'
);

INSERT INTO executive_refund_test_state (key, value)
SELECT 'refund_approved', public.transition_refund_atomic(
  ((SELECT value->'refund'->>'id' FROM executive_refund_test_state WHERE key = 'refund_request'))::uuid,
  'approve', 30.00, 'pgTAP approver', NULL, NULL
);

INSERT INTO executive_refund_test_state (key, value)
SELECT 'refund_processed', public.transition_refund_atomic(
  ((SELECT value->'refund'->>'id' FROM executive_refund_test_state WHERE key = 'refund_request'))::uuid,
  'process', NULL, 'pgTAP cashier', NULL, 'PGTAP-EXEC-REFUND-PAYOUT-001'
);

SELECT is(
  (public.get_executive_bi_metrics(CURRENT_DATE + 45, CURRENT_DATE + 45)->'revenue'->>'collected')::numeric,
  70.00::numeric,
  'executive collected revenue subtracts processed refunds from settled payments'
);

SELECT is(
  (public.get_executive_bi_metrics(CURRENT_DATE + 45, CURRENT_DATE + 45)->'revenue'->>'outstanding')::numeric,
  30.00::numeric,
  'executive outstanding revenue includes the amount returned through a processed refund'
);

SELECT * FROM finish();
ROLLBACK;
