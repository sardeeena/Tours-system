BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(42);

SELECT ok(
  to_regprocedure('public.record_payment_atomic(text,numeric,text,text,text,text,text,text,text,text)') IS NOT NULL,
  'atomic payment recording RPC exists'
);
SELECT ok(
  to_regprocedure('public.request_refund_atomic(text,uuid,numeric,text,text,text,text,text,text)') IS NOT NULL,
  'atomic refund request RPC exists'
);
SELECT ok(
  to_regprocedure('public.transition_refund_atomic(uuid,text,numeric,text,text,text)') IS NOT NULL,
  'atomic refund transition RPC exists'
);

SELECT ok(
  (SELECT COALESCE(array_to_string(proconfig, ','), '') LIKE '%search_path=""%'
   FROM pg_proc WHERE oid = 'public.record_payment_atomic(text,numeric,text,text,text,text,text,text,text,text)'::regprocedure),
  'payment RPC pins an empty search_path'
);
SELECT ok(
  (SELECT COALESCE(array_to_string(proconfig, ','), '') LIKE '%search_path=""%'
   FROM pg_proc WHERE oid = 'public.request_refund_atomic(text,uuid,numeric,text,text,text,text,text,text)'::regprocedure),
  'refund request RPC pins an empty search_path'
);
SELECT ok(
  (SELECT COALESCE(array_to_string(proconfig, ','), '') LIKE '%search_path=""%'
   FROM pg_proc WHERE oid = 'public.transition_refund_atomic(uuid,text,numeric,text,text,text)'::regprocedure),
  'refund transition RPC pins an empty search_path'
);

SELECT ok(NOT has_function_privilege('anon', 'public.record_payment_atomic(text,numeric,text,text,text,text,text,text,text,text)', 'EXECUTE'),
  'anonymous role cannot record payments');
SELECT ok(NOT has_function_privilege('anon', 'public.request_refund_atomic(text,uuid,numeric,text,text,text,text,text,text)', 'EXECUTE'),
  'anonymous role cannot request refunds');
SELECT ok(NOT has_function_privilege('anon', 'public.transition_refund_atomic(uuid,text,numeric,text,text,text)', 'EXECUTE'),
  'anonymous role cannot transition refunds');
SELECT ok(has_function_privilege('authenticated', 'public.record_payment_atomic(text,numeric,text,text,text,text,text,text,text,text)', 'EXECUTE'),
  'authenticated role can call payment RPC subject to internal admin authorization');
SELECT ok(has_function_privilege('authenticated', 'public.request_refund_atomic(text,uuid,numeric,text,text,text,text,text,text)', 'EXECUTE'),
  'authenticated role can call refund request RPC subject to internal admin authorization');
SELECT ok(has_function_privilege('authenticated', 'public.transition_refund_atomic(uuid,text,numeric,text,text,text)', 'EXECUTE'),
  'authenticated role can call refund transition RPC subject to internal admin authorization');

SELECT ok(NOT has_table_privilege('authenticated', 'public.payment_transactions', 'INSERT'),
  'authenticated clients cannot bypass payment RPC with direct inserts');
SELECT ok(NOT has_table_privilege('authenticated', 'public.payment_transactions', 'UPDATE'),
  'authenticated clients cannot directly mutate payment ledger rows');
SELECT ok(NOT has_table_privilege('authenticated', 'public.refund_records', 'INSERT'),
  'authenticated clients cannot bypass refund RPC with direct inserts');
SELECT ok(NOT has_table_privilege('authenticated', 'public.refund_records', 'UPDATE'),
  'authenticated clients cannot directly mutate refund workflow rows');

SELECT ok(NOT has_table_privilege('authenticated', 'public.payment_transactions', 'TRUNCATE'),
  'authenticated clients cannot truncate the payment ledger');
SELECT ok(NOT has_table_privilege('authenticated', 'public.refund_records', 'TRUNCATE'),
  'authenticated clients cannot truncate refund records');
SELECT ok(NOT has_table_privilege('anon', 'public.payment_transactions', 'SELECT'),
  'anonymous clients cannot read payment transaction records');
SELECT ok(NOT has_table_privilege('anon', 'public.payment_providers', 'SELECT'),
  'anonymous clients cannot read payment provider metadata');
SELECT ok(has_column_privilege('authenticated', 'public.payment_providers', 'id', 'SELECT'),
  'authenticated staff can read safe payment provider identifiers');
SELECT ok(NOT has_column_privilege('authenticated', 'public.payment_providers', 'config', 'SELECT'),
  'authenticated clients cannot read provider configuration or future credentials');

SELECT ok(EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='payment_transactions_idempotency_key_uidx'),
  'payment idempotency keys are unique');
SELECT ok(EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='payment_transactions_provider_reference_uidx'),
  'payment transaction references are unique per provider');
SELECT ok(EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='refund_records_idempotency_key_uidx'),
  'refund idempotency keys are unique');

SELECT ok(EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='refund_records_processed_reference_uidx'),
  'processed refund payout references are unique');
SELECT is((SELECT name FROM public.payment_providers WHERE id='bank_transfer'),
  'Bank transfer (manual)', 'unverified bank-provider branding is replaced with neutral manual reconciliation wording');

SELECT ok(to_regprocedure('public.next_invoice_number()') IS NOT NULL,
  'server-side invoice number allocator exists');
SELECT ok((SELECT COALESCE(array_to_string(proconfig, ','), '') LIKE '%search_path=""%'
  FROM pg_proc WHERE oid='public.next_invoice_number()'::regprocedure),
  'invoice number allocator pins an empty search_path');
SELECT ok(NOT has_function_privilege('anon', 'public.next_invoice_number()', 'EXECUTE'),
  'anonymous role cannot allocate invoice numbers');
SELECT ok(has_function_privilege('authenticated', 'public.next_invoice_number()', 'EXECUTE'),
  'authenticated role can allocate invoice numbers subject to internal admin authorization');
SELECT ok(EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='invoices_booking_id_uidx'),
  'a booking cannot receive duplicate invoices');

INSERT INTO public.tours (title, slug, status, price, max_guests)
VALUES ('pgTAP Finance Test Tour', 'pgtap-finance-test', 'published', 100.00, 10);

CREATE TEMP TABLE finance_test_state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
) ON COMMIT DROP;

INSERT INTO finance_test_state (key, value)
SELECT 'booking', public.create_booking_atomic(
  'pgtap-finance-test', CURRENT_DATE + 60, 1, 0, 0,
  'Finance', 'Guest', 'pgtap-finance@example.test', '+201000000009', 'Egypt',
  'Test Hotel', NULL, NULL, '[]'::jsonb, NULL,
  'pay_at_pickup', NULL, 'idem_pgtap_finance_booking_0001'
);

SELECT set_config('request.jwt.claims', '{"role":"service_role"}', TRUE);

INSERT INTO finance_test_state (key, value)
SELECT 'payment_one', public.record_payment_atomic(
  (SELECT value->>'bookingReference' FROM finance_test_state WHERE key='booking'),
  40.00, 'EUR', 'Cash', 'cash', 'Paid', 'PGTAP-FIN-PAY-001',
  'First installment', 'pgTAP', 'idem_pgtap_fin_payment_0001'
);

SELECT ok((SELECT (value->>'success')::boolean FROM finance_test_state WHERE key='payment_one'),
  'atomic payment RPC records a valid manual payment');
SELECT is((SELECT value->'payment'->>'status' FROM finance_test_state WHERE key='payment_one'),
  'Partially Paid', 'a partial amount cannot be recorded as a fully paid transaction');

INSERT INTO finance_test_state (key, value)
SELECT 'payment_two', public.record_payment_atomic(
  (SELECT value->>'bookingReference' FROM finance_test_state WHERE key='booking'),
  60.00, 'EUR', 'Cash', 'cash', 'Paid', 'PGTAP-FIN-PAY-002',
  'Final installment', 'pgTAP', 'idem_pgtap_fin_payment_0002'
);

SELECT is((SELECT value->'payment'->>'status' FROM finance_test_state WHERE key='payment_two'),
  'Paid', 'the final installment is recorded as paid when the booking total is reached');
SELECT is((SELECT payment_status FROM public.bookings
  WHERE booking_reference=(SELECT value->>'bookingReference' FROM finance_test_state WHERE key='booking')),
  'paid', 'booking payment status is updated atomically with payment recording');

INSERT INTO finance_test_state (key, value)
SELECT 'payment_replay', public.record_payment_atomic(
  (SELECT value->>'bookingReference' FROM finance_test_state WHERE key='booking'),
  40.00, 'EUR', 'Cash', 'cash', 'Paid', 'PGTAP-FIN-PAY-001',
  'First installment', 'pgTAP', 'idem_pgtap_fin_payment_0001'
);

SELECT is((SELECT value->'payment'->>'id' FROM finance_test_state WHERE key='payment_replay'),
  (SELECT value->'payment'->>'id' FROM finance_test_state WHERE key='payment_one'),
  'retrying the same payment idempotency key returns the original transaction');

INSERT INTO finance_test_state (key, value)
SELECT 'refund_request', public.request_refund_atomic(
  (SELECT value->>'bookingReference' FROM finance_test_state WHERE key='booking'),
  ((SELECT value->'payment'->>'id' FROM finance_test_state WHERE key='payment_one'))::uuid,
  40.00, 'EUR', 'pgTAP refund test', 'Cash Return', 'pgTAP', NULL,
  'idem_pgtap_fin_refund_0001'
);

SELECT ok((SELECT (value->>'success')::boolean FROM finance_test_state WHERE key='refund_request'),
  'atomic refund request is persisted for approval');

INSERT INTO finance_test_state (key, value)
SELECT 'refund_approved', public.transition_refund_atomic(
  ((SELECT value->'refund'->>'id' FROM finance_test_state WHERE key='refund_request'))::uuid,
  'approve', 30.00, 'pgTAP approver', NULL, NULL
);

SELECT is((SELECT value->'refund'->>'status' FROM finance_test_state WHERE key='refund_approved'),
  'approved', 'refund approval is recorded through the controlled transition RPC');

INSERT INTO finance_test_state (key, value)
SELECT 'refund_processed', public.transition_refund_atomic(
  ((SELECT value->'refund'->>'id' FROM finance_test_state WHERE key='refund_request'))::uuid,
  'process', NULL, 'pgTAP cashier', NULL, 'PGTAP-FIN-REFUND-001'
);

SELECT is((SELECT value->'refund'->>'status' FROM finance_test_state WHERE key='refund_processed'),
  'processed', 'only an approved refund can be marked processed');
SELECT is((SELECT payment_status FROM public.bookings
  WHERE booking_reference=(SELECT value->>'bookingReference' FROM finance_test_state WHERE key='booking')),
  'partially_paid', 'processed refund recalculates the booking net payment status');

SELECT ok((SELECT count(*) >= 4 FROM public.audit_logs
  WHERE entity_type IN ('payment_transaction','refund_record')
    AND action IN ('payment.recorded','refund.requested','refund.approve','refund.process')),
  'payment and refund lifecycle actions write audit log entries');

SELECT * FROM finish();

ROLLBACK;
