BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(9);

-- Isolated test fixtures. All writes are rolled back at the end of this file.
INSERT INTO public.tours (id, title, slug, status, price, max_guests)
VALUES (
  'f1000000-0000-4000-8000-000000000001',
  'Invoice Sync Test Tour',
  'invoice-sync-test-tour',
  'published',
  100,
  12
);

INSERT INTO public.bookings (
  id, booking_reference, tour_id, booking_date, total, currency
)
VALUES (
  'f2000000-0000-4000-8000-000000000001',
  'INV-SYNC-TEST-20261110',
  'f1000000-0000-4000-8000-000000000001',
  CURRENT_DATE + 1,
  100,
  'EUR'
);

INSERT INTO public.payment_transactions (
  id, booking_id, amount, currency, payment_method, status
)
VALUES (
  'f3000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000001',
  40,
  'EUR',
  'Cash',
  'Paid'
);

INSERT INTO public.refund_records (
  id, booking_id, payment_id, amount, requested_amount, approved_amount,
  currency, reason, refund_method, status
)
VALUES (
  'f4000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000001',
  'f3000000-0000-4000-8000-000000000001',
  10,
  10,
  10,
  'EUR',
  'Invoice synchronization test',
  'Cash Return',
  'processed'
);

INSERT INTO public.invoices (
  id, invoice_number, booking_id, total, currency, status, paid, balance
)
VALUES (
  'f5000000-0000-4000-8000-000000000001',
  'INV-SYNC-TEST-20261110',
  'f2000000-0000-4000-8000-000000000001',
  100,
  'EUR',
  'issued',
  999,
  -899
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.invoices
    WHERE id = 'f5000000-0000-4000-8000-000000000001'
      AND paid = 30
      AND balance = 70
      AND status = 'partially_paid'
  ),
  'invoice creation recalculates net paid after an existing processed refund'
);

INSERT INTO public.payment_transactions (
  id, booking_id, amount, currency, payment_method, status
)
VALUES (
  'f3000000-0000-4000-8000-000000000002',
  'f2000000-0000-4000-8000-000000000001',
  60,
  'EUR',
  'Cash',
  'Paid'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.invoices
    WHERE id = 'f5000000-0000-4000-8000-000000000001'
      AND paid = 90
      AND balance = 10
      AND status = 'partially_paid'
  ),
  'a later payment updates invoice paid amount and balance'
);

UPDATE public.refund_records
SET status = 'rejected'
WHERE id = 'f4000000-0000-4000-8000-000000000001';

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.invoices
    WHERE id = 'f5000000-0000-4000-8000-000000000001'
      AND paid = 100
      AND balance = 0
      AND status = 'paid'
  ),
  'rejected refund no longer reduces the invoice paid amount'
);

UPDATE public.payment_transactions
SET amount = 50
WHERE id = 'f3000000-0000-4000-8000-000000000002';

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.invoices
    WHERE id = 'f5000000-0000-4000-8000-000000000001'
      AND paid = 90
      AND balance = 10
      AND status = 'partially_paid'
  ),
  'payment amount corrections recalculate invoice totals'
);

UPDATE public.invoices
SET total = 120
WHERE id = 'f5000000-0000-4000-8000-000000000001';

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.invoices
    WHERE id = 'f5000000-0000-4000-8000-000000000001'
      AND paid = 90
      AND balance = 30
      AND status = 'partially_paid'
  ),
  'invoice total corrections recalculate the outstanding balance'
);

SELECT ok(
  (
    SELECT i.indisunique AND i.indisvalid
    FROM pg_index AS i
    WHERE i.indexrelid = 'public.invoices_booking_id_uidx'::regclass
  ),
  'the canonical existing unique index enforces one invoice per booking'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'idx_invoices_booking_id'
  ),
  'the redundant invoice booking index is absent'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.sync_invoice_financial_totals(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.sync_invoice_financial_totals(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.sync_invoice_financial_totals_trigger()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.sync_invoice_financial_totals_trigger()', 'EXECUTE'),
  'invoice synchronization functions are not directly executable by clients'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_trigger
    WHERE tgname = 'trg_sync_invoice_financial_totals'
      AND NOT tgisinternal
  ),
  3,
  'payment, refund, and invoice changes all invoke the synchronization trigger'
);

SELECT * FROM finish();
ROLLBACK;
